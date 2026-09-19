require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 10000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const SEED = path.join(DATA_DIR, "seed-udc.json");
const MRF = process.env.MRF_PATH || path.join(DATA_DIR, "udc-mrf.json");

app.use(cors());
app.use(express.json({limit:"2mb"}));
app.use(express.static(ROOT));

function norm(s){
  return String(s||"").toLowerCase().normalize("NFKD")
    .replace(/[’']/g,"'").replace(/[^a-z0-9.()\-+/: ]+/g," ")
    .replace(/\s+/g," ").trim();
}
function tokens(s){ return new Set(norm(s).split(/\s+/).filter(x=>x.length>1)); }

function normalizeRecord(r){
  if(!r) return null;
  const title = r.title || r.name || r.caption || r.term || "";
  const udc = r.udc || r.notation || r.classNumber || r.class_number || "";
  if(!title || !udc) return null;
  return {
    title:String(title), normalized_title:norm(title),
    udc:String(udc).trim(),
    main_subject:String(r.main_subject||r.mainSubject||r.subject||""),
    sub_subject:String(r.sub_subject||r.subSubject||""),
    explanation:String(r.explanation||r.note||""),
    verified:Boolean(r.verified),
    source:String(r.source||"imported dataset")
  };
}
function readDataset(file){
  const ext=path.extname(file).toLowerCase();
  const raw=fs.readFileSync(file,"utf8").replace(/^\uFEFF/,"");
  if(ext===".json"){
    const obj=JSON.parse(raw);
    const arr=Array.isArray(obj)?obj:(obj.records||obj.classes||obj.entries||[]);
    return arr.map(normalizeRecord).filter(Boolean);
  }
  if(ext===".csv"){
    const lines=raw.split(/\r?\n/).filter(Boolean);
    const headers=lines.shift().split(",").map(x=>x.trim().replace(/^"|"$/g,""));
    return lines.map(line=>{
      const cols=line.split(",").map(x=>x.trim().replace(/^"|"$/g,""));
      const o={}; headers.forEach((h,i)=>o[h]=cols[i]||""); return normalizeRecord(o);
    }).filter(Boolean);
  }
  return raw.split(/\r?\n/).map(line=>{
    const m=line.match(/^\s*([^|\t]+)\s*[\|\t]\s*(\S+)(?:[\|\t](.*))?$/);
    return m ? normalizeRecord({title:m[1],udc:m[2],subject:m[3]||""}) : null;
  }).filter(Boolean);
}

let records=[];
let meta={licensed:false,count:0,source:"seed reference only"};
function loadAll(){
  records=[];
  try { if(fs.existsSync(SEED)) records.push(...readDataset(SEED)); } catch(e){ console.error("Seed:",e.message); }
  if(fs.existsSync(MRF)){
    try {
      const imported=readDataset(MRF);
      records.push(...imported);
      meta={licensed:true,count:imported.length,source:"licensed/imported dataset"};
    } catch(e){ console.error("MRF:",e.message); meta={licensed:false,count:records.length,source:"seed reference only"}; }
  } else meta={licensed:false,count:records.length,source:"seed reference only"};
  const seen=new Set();
  records=records.filter(r=>{const k=r.normalized_title+"|"+r.udc;if(seen.has(k))return false;seen.add(k);return true;});
}
loadAll();

function localSearch(title,limit=10){
  const q=norm(title), qt=tokens(q);
  return records.map(r=>{
    const rt=tokens(r.normalized_title);
    let overlap=0; for(const t of qt) if(rt.has(t)) overlap++;
    let score=overlap/(Math.max(qt.size,rt.size)||1);
    if(r.normalized_title===q) score=1;
    else if(r.normalized_title.includes(q)||q.includes(r.normalized_title)) score=Math.max(score,.90);
    return {...r,score};
  }).filter(x=>x.score>=.34).sort((a,b)=>b.score-a.score).slice(0,limit);
}
function validUdc(u){
  if(!u || u==="0" || u==="—" || u==="-") return false;
  return /^[0-9][0-9.()+:'"\/\- ]*$/.test(String(u).trim());
}

const schema={
  type:"object",
  properties:{
    status:{type:"string",enum:["classified","unverified","no_result"]},
    udc_number:{type:"string"},
    main_subject:{type:"string"},
    sub_subject:{type:"string"},
    explanation:{type:"string"},
    confidence:{type:"string",enum:["High","Medium","Low"]},
    source_note:{type:"string"}
  },
  required:["status","udc_number","main_subject","sub_subject","explanation","confidence","source_note"]
};

function citations(resp){
  const chunks=resp?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return chunks.filter(x=>x.web?.uri).slice(0,8).map(x=>({title:x.web.title||"",uri:x.web.uri}));
}

async function groqResearch(title){
  if(!process.env.GROQ_API_KEY) return "";
  try{
    const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+process.env.GROQ_API_KEY},
      body:JSON.stringify({
        model:process.env.GROQ_MODEL||"openai/gpt-oss-120b",
        messages:[
          {role:"system",content:"You are research-only support for a UDC classifier. Do not give a final classification number. Identify terminology, possible UDC hierarchy areas, and what should be verified."},
          {role:"user",content:`Research clues for this book title: "${title}". Focus on UDC, not DDC.`}
        ],
        temperature:0.1,max_tokens:800
      })
    });
    if(!r.ok) return "";
    const j=await r.json();
    return j.choices?.[0]?.message?.content || "";
  }catch(_){ return ""; }
}

async function geminiFinal(title, hits, research){
  if(!process.env.GEMINI_API_KEY) throw new Error("GEMINI_KEY_MISSING");
  const models=(process.env.GEMINI_MODELS||"gemini-2.5-flash,gemini-2.5-pro,gemini-2.0-flash")
    .split(",").map(x=>x.trim()).filter(Boolean);

  const local = hits.length ? hits.map((r,i)=>
    `${i+1}. ${r.title} | ${r.udc} | ${r.main_subject} | verified=${r.verified} | score=${r.score.toFixed(2)}`
  ).join("\n") : "No close local record.";

  const prompt=`You are the FINAL Universal Decimal Classification (UDC) book-title classifier.

TITLE: "${title}"

SUPPLIED DATABASE EVIDENCE:
${local}

OPTIONAL RESEARCH NOTES (NOT A FINAL ANSWER):
${research || "None"}

RULES:
- UDC ONLY. Never DDC.
- First assess whether a supplied verified record is genuinely an exact/direct match. Do not force a match.
- If no direct match, determine the subject from the whole title and use UDC hierarchy/notation.
- Apply auxiliaries only when justified: place, language, form, time, relation, etc.
- Preserve UDC punctuation and notation.
- Use Google Search grounding to verify the classification against authoritative/credible UDC evidence where possible.
- Prefer UDC Consortium material and authoritative library cataloguing/reference sources.
- Do not invent a number, do not output 0, and do not use a placeholder.
- If the evidence is not defensible, return status "unverified" with an empty udc_number.
- Return JSON only using the requested schema.
- The confidence field describes evidence quality, not a guarantee.
`;

  let last;
  for(const model of models){
    try{
      const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
      const resp=await ai.models.generateContent({
        model,
        contents:prompt,
        config:{
          tools:[{googleSearch:{}}],
          responseMimeType:"application/json",
          responseSchema:schema
        }
      });
      const data=JSON.parse(resp.text||"{}");
      if(data.status==="classified" && validUdc(data.udc_number)){
        return {...data,model,citations:citations(resp)};
      }
      if(data.status==="unverified" || data.status==="no_result"){
        return {...data,model,citations:citations(resp)};
      }
      last=new Error("INVALID_GEMINI_RESULT");
    }catch(e){
      last=e;
      console.error("Gemini model failed:",model,e.message);
    }
  }
  throw last || new Error("GEMINI_UNAVAILABLE");
}

app.get("/health",(req,res)=>res.json({
  ok:true,version:"V33 ONE-CLICK",
  geminiConfigured:!!process.env.GEMINI_API_KEY,
  groqConfigured:!!process.env.GROQ_API_KEY,
  licensedDatasetLoaded:meta.licensed,
  importedClassCount:meta.count,
  recordsInMemory:records.length
}));

app.get("/api/status",(req,res)=>res.json({
  version:"V33 ONE-CLICK",
  finalProvider:"Gemini",
  googleSearchGrounding:true,
  groqRole:"research-only",
  licensedDatasetLoaded:meta.licensed,
  importedClassCount:meta.count,
  recordsInMemory:records.length,
  message:meta.licensed
    ? "Imported/licensed UDC dataset loaded."
    : "No licensed MRF loaded; bundled records are only starter references."
}));

app.post("/api/classify",async(req,res)=>{
  const title=String(req.body?.title||"").trim();
  if(!title) return res.status(400).json({error:"Enter a book title."});

  const hits=localSearch(title,10);
  const exact=hits.find(x=>x.score===1 && x.verified===true);
  if(exact){
    return res.json({
      status:"classified",final:true,provider:"Local verified direct match",
      title,udc_number:exact.udc,main_subject:exact.main_subject,
      sub_subject:exact.sub_subject,explanation:exact.explanation,
      confidence:"High",citations:[],model:"local-direct-match",
      note:"Exact/direct match from supplied verified dataset."
    });
  }

  const research=await groqResearch(title);
  try{
    const g=await geminiFinal(title,hits,research);
    const ok=g.status==="classified" && validUdc(g.udc_number);
    return res.json({
      status:ok?"classified":"unverified",final:ok,provider:"Gemini",
      title,udc_number:ok?g.udc_number:"",
      main_subject:g.main_subject||"",sub_subject:g.sub_subject||"",
      explanation:g.explanation||"",confidence:g.confidence||"Low",
      citations:g.citations||[],model:g.model||"",
      localMatches:hits.slice(0,5),
      note:"Gemini is the only AI allowed to produce the final classification. Groq is research-only."
    });
  }catch(e){
    const code=e.message==="GEMINI_KEY_MISSING"?"GEMINI_KEY_MISSING":"GEMINI_UNAVAILABLE";
    return res.status(200).json({
      status:"unverified",final:false,provider:"Gemini",title,
      udc_number:"",main_subject:"",sub_subject:"",
      explanation:code==="GEMINI_KEY_MISSING"
        ?"Gemini API key is not configured on the server."
        :"Gemini could not complete verification. No UDC number was guessed.",
      confidence:"Low",citations:[],model:"",
      localMatches:hits.slice(0,5),error_code:code
    });
  }
});

const upload=multer({dest:path.join(ROOT,".uploads"),limits:{fileSize:100*1024*1024}});
app.post("/api/import-mrf",upload.single("file"),(req,res)=>{
  if(!req.file) return res.status(400).json({error:"No file uploaded."});
  try{
    const imported=readDataset(req.file.path);
    if(!imported.length) throw new Error("No readable UDC records found.");
    fs.copyFileSync(req.file.path,MRF);
    fs.unlinkSync(req.file.path);
    loadAll();
    res.json({ok:true,loaded:imported.length,total:records.length,message:"UDC dataset imported."});
  }catch(e){
    try{fs.unlinkSync(req.file.path)}catch(_){}
    res.status(400).json({error:e.message});
  }
});

app.listen(PORT,()=>console.log(`UDC One-Click V33 listening on ${PORT}`));
