import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({limit:"1mb"}));
app.use(express.static(__dirname));

let starter=[];
try { starter=JSON.parse(fs.readFileSync(path.join(__dirname,"seed-udc.json"),"utf8")); } catch {}

const MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash"
].filter((x,i,a)=>x && a.indexOf(x)===i);

const sleep = ms => new Promise(r=>setTimeout(r,ms));

function cleanJSON(text){
  if(!text) return null;
  let s=text.replace(/```json/gi,"").replace(/```/g,"").trim();
  try{return JSON.parse(s)}catch{}
  const m=s.match(/\{[\s\S]*\}/);
  if(m) try{return JSON.parse(m[0])}catch{}
  return null;
}

function normalize(x,title){
  x=x&&typeof x==="object"?x:{};
  return {
    bookTitle:x.bookTitle||title,
    finalUdcNumber:String(x.finalUdcNumber||x.udc||"").trim(),
    mainSubject:x.mainSubject||"",
    subSubject:x.subSubject||"",
    shortExplanation:x.shortExplanation||"",
    breakdown:x.breakdown||"",
    confidence:x.confidence||"Unverified",
    verificationStatus:x.verificationStatus||"UNVERIFIED",
    sources:Array.isArray(x.sources)?x.sources.slice(0,10):[],
    searchedQueries:Array.isArray(x.searchedQueries)?x.searchedQueries.slice(0,10):[]
  };
}

function promptFor(title, research=""){
return `You are the FINAL Universal Decimal Classification (UDC) classifier.
UDC ONLY — NEVER DDC.

Classify the complete book title, not isolated keywords.
Use UDC Abridged Edition terminology and notation as far as it can be established.
Consider main classes, subdivisions, language, literature, literary form, place auxiliaries, time auxiliaries, form auxiliaries, point-of-view auxiliaries, common auxiliaries and connecting symbols where applicable.

IMPORTANT:
- A DDC number is NOT a UDC number.
- Never invent a number just to fill the field.
- Search web evidence when search is available.
- Prefer explicit UDC evidence from authoritative/reputable library or UDC reference sources.
- If evidence is incomplete, you may still give the most defensible classification from your UDC knowledge, but mark confidence honestly.
- Do not output 0 as a fallback.
- Return ONLY valid JSON.

Required JSON:
{
 "bookTitle": "...",
 "finalUdcNumber": "...",
 "mainSubject": "...",
 "subSubject": "...",
 "shortExplanation": "...",
 "breakdown": "...",
 "confidence": "High|Medium|Low|Unverified",
 "verificationStatus": "VERIFIED|AI_CLASSIFICATION|UNVERIFIED",
 "sources": [{"title":"...","url":"..."}],
 "searchedQueries": ["..."]
}

Title: ${title}

Optional research notes (never authoritative):
${research.slice(0,5000)}
`;
}

async function geminiRequest(model,title,research,useSearch){
  if(!process.env.GEMINI_API_KEY) throw new Error("GEMINI_KEY_MISSING");

  const body={
    contents:[{role:"user",parts:[{text:promptFor(title,research)}]}],
    generationConfig:{temperature:0.05,maxOutputTokens:1800}
  };

  // Keep Search as an optional first attempt. If a key/model rejects the tool,
  // retry the same model without Search instead of stopping the whole request.
  if(useSearch) body.tools=[{google_search:{}}];

  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),30000);
  try{
    const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const r=await fetch(url,{
      method:"POST",
      headers:{"Content-Type":"application/json","x-goog-api-key":process.env.GEMINI_API_KEY},
      body:JSON.stringify(body),
      signal:ctl.signal
    });
    const raw=await r.text();
    let data=null; try{data=JSON.parse(raw)}catch{}
    if(!r.ok) throw new Error(data?.error?.message||`Gemini HTTP ${r.status}`);
    const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"";
    const parsed=cleanJSON(text);
    if(!parsed) throw new Error("GEMINI_NO_JSON");
    const out=normalize(parsed,title);
    const chunks=data?.candidates?.[0]?.groundingMetadata?.groundingChunks||[];
    const grounded=chunks.map(c=>c.web).filter(Boolean).map(w=>({title:w.title||"Google result",url:w.uri})).filter(x=>x.url);
    if(!out.sources.length && grounded.length) out.sources=grounded.slice(0,10);
    if(!out.searchedQueries.length) out.searchedQueries=data?.candidates?.[0]?.groundingMetadata?.webSearchQueries||[];
    if(out.finalUdcNumber && !out.verificationStatus) out.verificationStatus=grounded.length?"VERIFIED":"AI_CLASSIFICATION";
    return {out,grounded:grounded.length>0};
  }finally{clearTimeout(timer)}
}

async function groqResearch(title){
  if(!process.env.GROQ_API_KEY) return "";
  try{
    const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.GROQ_API_KEY}`},
      body:JSON.stringify({
        model:process.env.GROQ_MODEL||"groq/compound",
        messages:[{role:"system",content:"Research-only support for UDC classification. Never pretend DDC is UDC and never invent a number."},{role:"user",content:`Research UDC clues for: ${title}`}],
        temperature:0.1,max_completion_tokens:700
      }),
      signal:AbortSignal.timeout(12000)
    });
    if(!r.ok)return "";
    const d=await r.json();
    return d?.choices?.[0]?.message?.content||"";
  }catch{return ""}
}

app.get("/",(_req,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.get("/api/health",(_req,res)=>res.json({
  ok:true,
  geminiConfigured:Boolean(process.env.GEMINI_API_KEY),
  groqConfigured:Boolean(process.env.GROQ_API_KEY),
  modelsTried:MODELS
}));

app.post("/api/classify",async(req,res)=>{
  const title=String(req.body?.title||"").trim();
  if(!title)return res.status(400).json({ok:false,error:"TITLE_REQUIRED"});

  if(!process.env.GEMINI_API_KEY){
    return res.json({ok:false,error:"GEMINI_KEY_MISSING",message:"Add GEMINI_API_KEY in Render Environment Variables, then redeploy."});
  }

  const research=await groqResearch(title);
  let last="";
  // Each model gets up to two chances: Google-grounded, then plain Gemini.
  for(const model of MODELS){
    for(const search of [true,false]){
      try{
        const result=await geminiRequest(model,title,research,search);
        result.out.verificationStatus =
          result.out.finalUdcNumber
            ? (result.grounded ? "VERIFIED" : (result.out.verificationStatus==="VERIFIED"?"AI_CLASSIFICATION":result.out.verificationStatus))
            : "UNVERIFIED";
        return res.json({
          ok:true,
          engine:"Gemini",
          model,
          googleGrounding:result.grounded,
          researchUsed:Boolean(research),
          result:result.out
        });
      }catch(e){
        last=String(e?.message||e);
        // quota/rate-limit: move quickly to the next model; other errors also retry plain.
        await sleep(150);
      }
    }
  }

  res.json({
    ok:false,
    error:"ALL_GEMINI_ATTEMPTS_FAILED",
    message:"Gemini could not return a classification. Check the Render Gemini key, API access/billing, quota, and model access. No guessed UDC number was returned.",
    detail:last.slice(0,500)
  });
});

app.listen(PORT,()=>console.log(`UDC One-Click V37 listening on ${PORT}`));
