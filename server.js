import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));
const PORT = process.env.PORT || 10000;

const GEMINI_MODELS = (process.env.GEMINI_MODELS || [
  process.env.GEMINI_MODEL || "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.5-pro"
].filter(Boolean).join(",")).split(",").map(s => s.trim()).filter(Boolean);
const GROQ_MODELS = (process.env.GROQ_MODELS || [
  process.env.GROQ_MODEL || "groq/compound",
  "llama-3.3-70b-versatile"
].filter(Boolean).join(",")).split(",").map(s => s.trim()).filter(Boolean);

let starter = [];
try { starter = JSON.parse(fs.readFileSync(path.join(__dirname, "seed-udc.json"), "utf8")); } catch (_) {}

app.get("/", (_req,res) => res.sendFile(path.join(__dirname,"index.html")));
app.get("/api/health", (_req,res) => res.json({
  ok:true,
  geminiConfigured:Boolean(process.env.GEMINI_API_KEY),
  groqConfigured:Boolean(process.env.GROQ_API_KEY),
  geminiModels:GEMINI_MODELS,
  groqModels:GROQ_MODELS,
  version:"40.0.0"
}));

function compactStarter(){return starter.slice(0,120).map(x=>({title:x.title,udc:x.udc,subject:x.subject,breakdown:x.breakdown,explanation:x.explanation}));}
function cleanJson(text){
  if(!text) return null;
  const t=text.replace(/```json/gi,"").replace(/```/g,"").trim();
  try{return JSON.parse(t);}catch(_){ }
  const m=t.match(/\{[\s\S]*\}/); if(!m)return null;
  try{return JSON.parse(m[0]);}catch(_){return null;}
}
function normalize(obj,title,engine,model,verified=false){
  const r=obj&&typeof obj==="object"?obj:{};
  return {
    bookTitle:r.bookTitle||title,
    finalUdcNumber:String(r.finalUdcNumber||r.udc||"").trim(),
    mainSubject:r.mainSubject||"",
    subSubject:r.subSubject||"",
    shortExplanation:r.shortExplanation||r.explanation||"",
    breakdown:r.breakdown||"",
    confidence:r.confidence||"Best effort",
    verificationStatus:r.verificationStatus||((r.finalUdcNumber||r.udc)?(verified?"VERIFIED":"UNVERIFIED"):"UNVERIFIED"),
    sources:Array.isArray(r.sources)?r.sources.slice(0,10):[],
    searchedQueries:Array.isArray(r.searchedQueries)?r.searchedQueries.slice(0,10):[],
    engine, model
  };
}

const SYSTEM = `You are a production Universal Decimal Classification (UDC) classifier.
UDC ONLY. NEVER use DDC. The user gives a book title and expects the most appropriate UDC Abridged Edition classification.
Do real semantic classification, not keyword matching.
Critical guard: 004 means Computer science and technology. Do NOT use 004 merely because a title contains the generic word “technology”. Use 004 only when the work is actually about computing, computer science, computer technology, information technology, ICT, software, data processing, or a clearly equivalent computing subject. If “technology” refers to technology education, educational technology, science-and-technology teaching, or technology in a non-computing sense, do not force 004.
Critical guard: do not turn every “and” into “:” or “+”; identify the actual relationship and the principal subject first.
Use the official UDC hierarchy and notation conventions where evidence supports them. Consider main class, subdivisions, common/special auxiliaries, language, place, time, form, point of view and relation signs when actually justified.
Important: the word “and” does NOT automatically mean colon. Use +, :, / or other UDC notation only when the UDC construction is justified.
Do not invent a number. Do not output 0. Do not copy proprietary MRF data.
When web grounding is available, use it to verify UDC notation. Distinguish UDC from DDC in all evidence.
If exact title evidence is unavailable, classify from the title's clear subject using UDC hierarchy and state that it is an expert best-effort classification rather than pretending it was verified.
Return ONLY valid JSON with exactly these fields:
bookTitle, finalUdcNumber, mainSubject, subSubject, shortExplanation, breakdown, confidence, verificationStatus, sources, searchedQueries.
verificationStatus must be VERIFIED only when the number is actually supported by evidence; otherwise BEST_EFFORT or UNVERIFIED.
sources is an array of objects {title,url}; searchedQueries is an array of strings.`;

function promptFor(title,research="",allowBestEffort=true){return SYSTEM+`\n\nBook title: ${title}\n\nStarter records are hints only; never treat them as authoritative:\n${JSON.stringify(compactStarter())}\n\nResearch notes (non-authoritative):\n${research.slice(0,7000)}\n\n${allowBestEffort?"If verification is unavailable but the subject is clear, provide the most defensible UDC classification as BEST_EFFORT instead of returning an empty answer.":"If you cannot verify, leave finalUdcNumber empty."}`;}

async function gemini(title,model,useSearch=true,research=""){
  if(!process.env.GEMINI_API_KEY) throw new Error("GEMINI_KEY_MISSING");
  const body={contents:[{role:"user",parts:[{text:promptFor(title,research,true)}]}],generationConfig:{temperature:0.05,maxOutputTokens:2200,responseMimeType:"application/json"}};
  if(useSearch) body.tools=[{google_search:{}}];
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),40000);
  try{
    const resp=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
      method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":process.env.GEMINI_API_KEY},body:JSON.stringify(body),signal:controller.signal});
    const raw=await resp.text(); let data=null; try{data=JSON.parse(raw);}catch(_){ }
    if(!resp.ok){const e=new Error(data?.error?.message||`Gemini HTTP ${resp.status}`); e.status=resp.status; throw e;}
    const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"";
    const parsed=cleanJson(text); if(!parsed) throw new Error("GEMINI_INVALID_JSON");
    const chunks=data?.candidates?.[0]?.groundingMetadata?.groundingChunks||[];
    const grounded=chunks.map(c=>c.web).filter(Boolean).map(w=>({title:w.title||"Google source",url:w.uri})).filter(x=>x.url);
    const r=normalize(parsed,title,"Gemini",model,useSearch&&grounded.length>0);
    if(!r.sources.length)r.sources=grounded.slice(0,10);
    if(!r.searchedQueries.length)r.searchedQueries=data?.candidates?.[0]?.groundingMetadata?.webSearchQueries||[];
    return r;
  } finally {clearTimeout(timer);}
}

async function groq(title,research=""){if(!process.env.GROQ_API_KEY)throw new Error("GROQ_KEY_MISSING");
  let last=null;
  for(const model of GROQ_MODELS){
    const body={model,messages:[{role:"system",content:SYSTEM+"\nYou are the fallback classifier. Give the most defensible UDC Abridged classification from your knowledge. Never use DDC. Mark verificationStatus BEST_EFFORT unless you have explicit evidence."},{role:"user",content:`Book title: ${title}\nResearch notes:\n${research.slice(0,5000)}`}],temperature:0.05,max_completion_tokens:1800,response_format:{type:"json_object"}};
    try{const c=new AbortController();const timer=setTimeout(()=>c.abort(),25000);const resp=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.GROQ_API_KEY}`},body:JSON.stringify(body),signal:c.signal});clearTimeout(timer);const raw=await resp.text();let d=null;try{d=JSON.parse(raw)}catch(_){};if(!resp.ok){last=new Error(d?.error?.message||`Groq HTTP ${resp.status}`);continue;}const p=cleanJson(d?.choices?.[0]?.message?.content||"");if(p)return normalize(p,title,"Groq",model,false);}catch(e){last=e;}
  }
  throw last||new Error("GROQ_FAILED");
}

function semanticallyInvalid(result,title){
  const t=String(title||"").toLowerCase();
  const n=String(result?.finalUdcNumber||"").trim();
  const computerWords=/(\bcomputer(s)?\b|computing|computer science|information technology|\bit\b|ict|software|programming|data processing|informatics|digital technology)/i;
  // 004 is specifically computer science/technology; reject hallucinated 004 when the title does not actually concern computing.
  if(/(^|[:+\/])004(\b|[(:])/i.test(n) && !computerWords.test(t)) return true;
  if(/\b004\b/i.test(n) && !computerWords.test(t)) return true;
  return false;
}

async function classify(title){
  const errors=[];
  let research="";
  // Gemini is attempted model-by-model. Search-grounded call first, then the same model without search.
  for(const model of GEMINI_MODELS){
    for(const grounded of [true,false]){
      try{
        const r=await gemini(title,model,grounded,research);
        if(r.finalUdcNumber){
          if(semanticallyInvalid(r,title)){ errors.push(`${model}${grounded?"+search":""}: semantic guard rejected 004 for non-computing title`); continue; }
          return {result:r,route:`Gemini ${model}${grounded?" + Google Search":" (no search)"}`,fallback:false,errors};
        }
      }catch(e){errors.push(`${model}${grounded?"+search":""}: ${e.message}`);}
    }
  }
  // Groq keeps the app usable when Gemini quota is exhausted. It is clearly labelled as fallback.
  try{const r=await groq(title,research);if(r.finalUdcNumber){ if(semanticallyInvalid(r,title)){ errors.push(`Groq: semantic guard rejected 004 for non-computing title`); } else return {result:r,route:`Groq fallback (${r.model})`,fallback:true,errors}; }}catch(e){errors.push(`Groq: ${e.message}`);}
  // Last local exact-match safety net.
  const hit=starter.find(x=>String(x.title||"").trim().toLowerCase()===title.toLowerCase());
  if(hit)return {result:normalize(hit,title,"Local exact-match","seed-udc",true),route:"Local exact match",fallback:true,errors};
  const err=new Error("ALL_ENGINES_EXHAUSTED");err.details=errors.slice(-8);throw err;
}

app.post("/api/classify",async(req,res)=>{
  const title=String(req.body?.title||"").trim();
  if(!title)return res.status(400).json({ok:false,error:"TITLE_REQUIRED",message:"Enter a book title."});
  try{const out=await classify(title);res.json({ok:true,...out});}
  catch(e){res.status(200).json({ok:false,error:"ALL_ENGINES_EXHAUSTED",message:"All configured AI routes are temporarily unavailable. Check API quota/billing or add another API key.",details:e.details||[]});}
});
app.use((req,res)=>{if(req.method==="GET"&&!req.path.startsWith("/api/"))return res.sendFile(path.join(__dirname,"index.html"));res.status(404).json({ok:false,error:"NOT_FOUND"});});
app.listen(PORT,()=>console.log(`UDC One-Click V39 running on ${PORT}`));
