import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({limit:"64kb"}));
app.use(express.static(__dirname));

const port = Number(process.env.PORT || 10000);
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const groqModel = process.env.GROQ_MODEL || "groq/compound";

function keys(primary, plural) {
  return [...new Set(
    [process.env[plural] || "", process.env[primary] || ""]
      .flatMap(v => v.split(","))
      .map(v => v.trim())
      .filter(Boolean)
  )];
}
const geminiKeys = () => keys("GEMINI_API_KEY","GEMINI_API_KEYS");
const groqKeys = () => keys("GROQ_API_KEY","GROQ_API_KEYS");

function normalizeRecord(x, fallbackTitle="") {
  if (!x || typeof x !== "object") return null;
  const title = String(x.title ?? x.bookTitle ?? x.name ?? fallbackTitle).trim();
  const udc = String(x.udc ?? x.number ?? x.classification ?? x.classificationNumber ?? "").trim();
  if (!title || !udc || udc === "0" || udc === "-") return null;
  return {
    title, udc,
    mainSubject: x.mainSubject ?? x.subject ?? x.main_subject ?? "",
    subSubject: x.subSubject ?? x.sub_subject ?? "",
    explanation: x.explanation ?? x.breakdown ?? x.notes ?? "",
    confidence: x.confidence ?? "High",
    verified: x.verified !== false
  };
}

function loadLocal() {
  const p = path.join(__dirname,"udc-2700-key.json");
  if (!fs.existsSync(p)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(p,"utf8"));
    let arr = Array.isArray(raw) ? raw : (raw.records || raw.entries || []);
    if (!Array.isArray(arr) && raw && typeof raw === "object") {
      arr = Object.entries(raw).map(([k,v]) => typeof v === "object" ? {...v,title:v.title||k} : {title:k,udc:v});
    }
    return arr.map(x=>normalizeRecord(x)).filter(Boolean);
  } catch (e) {
    console.error("UDC key load error:",e.message);
    return [];
  }
}
const local = loadLocal();

function norm(s){return String(s||"").toLowerCase().replace(/[“”"'`]/g,"").replace(/[^a-z0-9]+/g," ").trim();}
function localMatch(title) {
  const q=norm(title);
  if(!q)return null;
  const exact=local.find(x=>norm(x.title)===q);
  if(exact)return exact;
  const compact=q.replace(/\s+/g," ");
  const contains=local.find(x=>{
    const t=norm(x.title);
    return t && (compact.includes(t) || t.includes(compact));
  });
  return contains || null;
}

const SYSTEM = `
You are a strict Universal Decimal Classification (UDC) book-classification verifier.
UDC ONLY. NEVER use DDC.

User gives a book title. Determine a UDC class ONLY when the evidence is sufficient.
Do not invent a notation. Do not output 0. Do not use a generic placeholder.
Prefer an exact/near-exact authoritative UDC source found through Google Search.
Use UDC notation and auxiliaries correctly when the evidence supports them.
For literary works distinguish language, literature and literary form.
For language works distinguish the subject from dictionary/grammar/form aspects.
If you cannot verify a defensible UDC number, return verified=false.

Return ONLY valid JSON:
{
  "verified": true|false,
  "udc": "string or empty",
  "title": "string",
  "mainSubject": "string",
  "subSubject": "string",
  "explanation": "string",
  "confidence": "High|Medium|Low|Not verified",
  "verificationLabel": "Google-grounded UDC verification",
  "evidence": "brief factual evidence",
  "sources": [{"title":"source title","url":"https://..."}]
}

If verified=false, udc MUST be empty and explain why.
Do not claim a source was consulted unless the returned grounding/search metadata supports it.
`;

function extractJSON(text) {
  const s=String(text||"").trim().replace(/^```json\s*/i,"").replace(/```$/,"").trim();
  try{return JSON.parse(s)}catch{}
  const a=s.indexOf("{"), b=s.lastIndexOf("}");
  if(a>=0 && b>a){try{return JSON.parse(s.slice(a,b+1))}catch{}}
  return null;
}

function groundingSources(resp) {
  const out=[];
  const chunks = resp?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  for(const c of chunks){
    const w=c?.web;
    if(w?.uri) out.push({title:w.title||w.uri,url:w.uri});
  }
  return [...new Map(out.map(x=>[x.url,x])).values()].slice(0,8);
}

async function geminiAttempt(key, title) {
  const ai = new GoogleGenAI({apiKey:key});
  const prompt = `${SYSTEM}\nTITLE: ${title}\nSearch the web for reliable UDC evidence. Prefer official UDC/UDC Consortium material or reputable library/cataloguing sources that explicitly show the UDC notation.`;
  const resp = await ai.models.generateContent({
    model: geminiModel,
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] }
  });
  const parsed=extractJSON(resp.text);
  if(!parsed) throw new Error("Gemini returned non-JSON");
  const sources=groundingSources(resp);
  if(parsed.verified && parsed.udc && sources.length===0){
    parsed.verified=false;
    parsed.udc="";
    parsed.confidence="Not verified";
    parsed.explanation="The model did not return Google grounding evidence, so no UDC number was accepted.";
  }
  parsed.sources=sources;
  parsed.verificationLabel = parsed.verified ? "Google-grounded UDC verification" : "Not verified";
  return parsed;
}

async function groqAttempt(key, title) {
  const groq=new Groq({apiKey:key});
  const prompt=`${SYSTEM}\nTITLE: ${title}\nUse web search if available. Return JSON only. If web evidence does not support a specific UDC number, return verified=false.`;
  const r=await groq.chat.completions.create({
    model:groqModel,
    messages:[{role:"system",content:SYSTEM},{role:"user",content:prompt}],
    temperature:0.1
  });
  const msg=r?.choices?.[0]?.message;
  const parsed=extractJSON(msg?.content);
  if(!parsed) throw new Error("Groq returned non-JSON");
  let sources=[];
  for(const t of (msg?.executed_tools||[])){
    const o=t?.output;
    if(typeof o==="string"){
      const urls=o.match(/https?:\/\/[^\s"'<>]+/g)||[];
      for(const u of urls.slice(0,8)) sources.push({title:"Groq web evidence",url:u.replace(/[),.;]+$/,"")});
    }
  }
  parsed.sources=[...new Map(sources.map(x=>[x.url,x])).values()].slice(0,8);
  parsed.verificationLabel=parsed.verified ? "Groq web-search verification" : "Not verified";
  return parsed;
}

function cleanResult(r,title) {
  if(!r || !r.verified || !r.udc || r.udc==="0" || r.udc==="-"){
    return {verified:false,title,message:r?.explanation||"No reliable UDC classification was found.",sources:r?.sources||[]};
  }
  return {
    verified:true,title:r.title||title,udc:String(r.udc).trim(),
    mainSubject:r.mainSubject||"",subSubject:r.subSubject||"",
    explanation:r.explanation||"",confidence:r.confidence||"Medium",
    verificationLabel:r.verificationLabel||"Verified",sources:r.sources||[]
  };
}

app.get("/api/health",(req,res)=>res.json({
  ok:true, version:"V18",
  localKeyRecords:local.length,
  geminiKeys:geminiKeys().length,
  groqKeys:groqKeys().length
}));

app.post("/api/classify", async (req,res)=>{
  const title=String(req.body?.title||"").trim();
  if(!title) return res.status(400).json({verified:false,message:"Enter a book title."});

  const hit=localMatch(title);
  if(hit) return res.json({...cleanResult(hit,title),providerStatus:"LOCAL KEY VERIFIED"});

  let last=[];
  for(const key of geminiKeys()){
    try {
      const r=await geminiAttempt(key,title);
      if(r?.verified && r?.udc) return res.json({...cleanResult(r,title),providerStatus:"Gemini + Google Search grounding"});
      last.push(r);
    } catch(e) {
      console.error("Gemini:",e.message);
      last.push({verified:false,explanation:e.message});
    }
  }

  for(const key of groqKeys()){
    try {
      const r=await groqAttempt(key,title);
      if(r?.verified && r?.udc) return res.json({...cleanResult(r,title),providerStatus:"Groq web-search fallback"});
      last.push(r);
    } catch(e) {
      console.error("Groq:",e.message);
      last.push({verified:false,explanation:e.message});
    }
  }

  return res.json({
    verified:false,title,
    message:"No reliable UDC classification was verified. The app did not invent a UDC number.",
    providerStatus:"NOT VERIFIED",
    diagnostics: process.env.NODE_ENV==="development" ? last : undefined
  });
});

app.use((req,res)=>res.sendFile(path.join(__dirname,"index.html")));

app.listen(port,()=>console.log(`UDC Ultimate V18 running on port ${port}`));
