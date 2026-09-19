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
  return [...new Set([process.env[plural] || "", process.env[primary] || ""]
    .flatMap(v => v.split(",")).map(v => v.trim()).filter(Boolean))];
}
const geminiKeys = () => keys("GEMINI_API_KEY","GEMINI_API_KEYS");
const groqKeys = () => keys("GROQ_API_KEY","GROQ_API_KEYS");

function normalizeRecord(x, fallbackTitle="") {
  if (!x || typeof x !== "object") return null;
  const title = String(x.title ?? x.bookTitle ?? x.name ?? fallbackTitle).trim();
  const udc = String(x.udc ?? x.number ?? x.classification ?? x.classificationNumber ?? "").trim();
  // Never load 0/placeholder records as answers.
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
  const candidates = ["udc-2700-key.json", "udc-key.json", "udc-2600-key.json"];
  for (const name of candidates) {
    const p = path.join(__dirname,name);
    if (!fs.existsSync(p)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(p,"utf8"));
      let arr = Array.isArray(raw) ? raw : (raw.records || raw.entries || raw.data || []);
      if (!Array.isArray(arr) && raw && typeof raw === "object") {
        arr = Object.entries(raw).map(([k,v]) => typeof v === "object" ? {...v,title:v.title||k} : {title:k,udc:v});
      }
      const loaded = arr.map(x=>normalizeRecord(x)).filter(Boolean);
      if (loaded.length) return {records:loaded,file:name};
    } catch (e) {
      console.error(`${name} load error:`,e.message);
    }
  }
  return {records:[],file:null};
}
const localState = loadLocal();
const local = localState.records;

function norm(s){
  return String(s||"").toLowerCase().normalize("NFKD")
    .replace(/[“”"'`]/g,"").replace(/[^a-z0-9]+/g," ").trim();
}
function localMatch(title) {
  const q=norm(title); if(!q)return null;
  const exact=local.find(x=>norm(x.title)===q); if(exact)return exact;
  // Only accept a contains match when it is clearly more specific than the query.
  const matches=local.filter(x=>{const t=norm(x.title);return t && (q.includes(t)||t.includes(q));});
  matches.sort((a,b)=>norm(b.title).length-norm(a.title).length);
  return matches[0] || null;
}

const SYSTEM = `
You are the UDC verification engine for a library classification application.
UDC ONLY. NEVER use DDC.

TASK
Classify a book title using Universal Decimal Classification. Determine a specific UDC number only when defensible evidence exists.

STRICT RULES
1. Never invent, guess, or substitute a UDC number.
2. Never output UDC 0 as a classification result. If unresolved, return verified=false and udc="".
3. Prefer the authoritative UDC Consortium / UDC material when available. Reputable library catalogues and classification documentation may corroborate it.
4. Use UDC notation correctly: main classes, common/special auxiliaries, +, /, :, ::, [ ], = language, (0...) form, (1/9) place, "..." time, -02/-03/-04/-05 and literary-form subdivisions where the evidence supports them.
5. Understand the whole title; do not classify from an isolated keyword when context changes the subject.
6. For language/literature, distinguish language, literature and literary form. For dictionaries, encyclopedias, handbooks and manuals, use the appropriate UDC form/subject treatment supported by evidence.
7. If the title is ambiguous or evidence conflicts, do NOT force an answer.
8. Return ONLY valid JSON.

JSON FORMAT
{
  "verified": true|false,
  "udc": "string or empty",
  "title": "string",
  "mainSubject": "string",
  "subSubject": "string",
  "explanation": "string",
  "confidence": "High|Medium|Low|Not verified",
  "evidence": "brief factual evidence",
  "sources": [{"title":"source title","url":"https://..."}]
}

When verified=false, udc MUST be empty.
Do not claim Google/web verification unless actual search/grounding evidence was returned.
`;

function extractJSON(text) {
  const s=String(text||"").trim().replace(/^```json\s*/i,"").replace(/```$/i,"").trim();
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

function groqSources(msg) {
  const out=[];
  for(const tool of (msg?.executed_tools||[])) {
    const results = tool?.search_results;
    if(Array.isArray(results)) {
      for(const r of results) {
        const url=r?.url || r?.link || r?.source_url;
        if(url) out.push({title:r?.title||url,url});
      }
    }
    const text=typeof tool?.output === "string" ? tool.output : "";
    for(const u of (text.match(/https?:\/\/[^\s"'<>]+/g)||[])) out.push({title:"Groq web evidence",url:u.replace(/[),.;]+$/g,"")});
  }
  return [...new Map(out.map(x=>[x.url,x])).values()].slice(0,8);
}

function isQuotaError(e) {
  const s=String(e?.message||e||"").toLowerCase();
  return /quota|rate.?limit|resource.?exhausted|429|too many requests|billing/.test(s);
}

function validAiResult(r, sources) {
  if(!r || r.verified!==true) return false;
  if(!String(r.udc||"").trim() || ["0","-","—"].includes(String(r.udc).trim())) return false;
  // Gemini must have grounding. Groq compound must have web evidence.
  if(!sources.length) return false;
  return true;
}

async function geminiAttempt(key, title) {
  const ai = new GoogleGenAI({apiKey:key});
  const prompt = `${SYSTEM}\nTITLE: ${title}\nUse Google Search grounding. Search specifically for UDC evidence and prefer official UDC Consortium material or reputable library/classification sources. Return JSON only.`;
  const resp = await ai.models.generateContent({
    model: geminiModel,
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] }
  });
  const parsed=extractJSON(resp.text);
  if(!parsed) throw new Error("Gemini returned non-JSON");
  const sources=groundingSources(resp);
  if(!validAiResult(parsed,sources)) {
    return {...parsed,verified:false,udc:"",sources,confidence:"Not verified"};
  }
  return {...parsed,verified:true,udc:String(parsed.udc).trim(),sources};
}

async function groqAttempt(key, title) {
  const groq=new Groq({apiKey:key,defaultHeaders:{"Groq-Model-Version":"latest"}});
  const prompt=`${SYSTEM}\nTITLE: ${title}\nUse the built-in web search to find UDC evidence. Prefer official UDC Consortium material or reputable library/classification sources. Return JSON only.`;
  const r=await groq.chat.completions.create({
    model:groqModel,
    messages:[{role:"system",content:SYSTEM},{role:"user",content:prompt}],
    temperature:0.1,
    compound_custom:{tools:{enabled_tools:["web_search","visit_website"]}}
  });
  const msg=r?.choices?.[0]?.message;
  const parsed=extractJSON(msg?.content);
  if(!parsed) throw new Error("Groq returned non-JSON");
  const sources=groqSources(msg);
  if(!validAiResult(parsed,sources)) return {...parsed,verified:false,udc:"",sources,confidence:"Not verified"};
  return {...parsed,verified:true,udc:String(parsed.udc).trim(),sources};
}

function cleanResult(r,title,provider) {
  if(!r || !r.verified || !r.udc || r.udc==="0" || r.udc==="-") {
    return {verified:false,title,message:"No reliable UDC classification was verified. The app did not invent a UDC number.",providerStatus:"NOT VERIFIED",sources:r?.sources||[]};
  }
  return {
    verified:true,title:r.title||title,udc:String(r.udc).trim(),
    mainSubject:r.mainSubject||"",subSubject:r.subSubject||"",
    explanation:r.explanation||r.evidence||"",confidence:r.confidence||"Medium",
    verificationLabel:provider==="gemini"?"✓ Gemini + Google Search verified":"✓ Groq web-search verified",
    providerStatus:provider==="gemini"?"GEMINI PRIMARY · GOOGLE GROUNDED":"GROQ FALLBACK · WEB VERIFIED",
    sources:r.sources||[]
  };
}

app.get("/api/health",(req,res)=>res.json({
  ok:true,version:"V24.1",localKeyRecords:local.length,localKeyFile:localState.file,
  geminiKeys:geminiKeys().length,groqKeys:groqKeys().length,
  googleGrounding:"via Gemini Google Search tool"
}));

app.post("/api/classify", async (req,res)=>{
  const title=String(req.body?.title||req.body?.bookTitle||req.body?.query||"").trim();
  if(!title) return res.status(400).json({verified:false,message:"Enter a book title."});

  // 1) Exact local key first. This costs no API quota.
  const hit=localMatch(title);
  if(hit) return res.json({...cleanResult(hit,title,"local"),providerStatus:"LOCAL UDC KEY VERIFIED",verificationLabel:"✓ Local UDC key verified"});

  let geminiFailed=false;
  let geminiQuota=false;
  // 2) Gemini primary, with every configured Gemini key tried.
  for(const key of geminiKeys()) {
    try {
      const r=await geminiAttempt(key,title);
      if(r?.verified && r?.udc) return res.json(cleanResult(r,title,"gemini"));
      geminiFailed=true;
    } catch(e) {
      geminiFailed=true; geminiQuota ||= isQuotaError(e);
      console.error("Gemini primary:",e.message);
    }
  }

  // 3) Groq is RESEARCH-ONLY. It can discover evidence/candidates, but it is
  //    NEVER allowed to become the final answer shown to the user.
  //    If Groq finds a candidate, send that candidate back to Gemini for the
  //    final UDC decision. This prevents a Groq classification from being
  //    displayed as the final answer.
  let groqResearch = null;
  for(const key of groqKeys()) {
    try {
      const r=await groqAttempt(key,title);
      if(r?.udc && r?.sources?.length) { groqResearch = r; break; }
    } catch(e) {
      console.error("Groq research fallback:",e.message);
    }
  }

  if(groqResearch) {
    for(const key of geminiKeys()) {
      try {
        const ai = new GoogleGenAI({apiKey:key});
        const reviewPrompt = `${SYSTEM}\nTITLE: ${title}\n\nA secondary research service found this candidate. It is NOT authoritative and MUST NOT be accepted blindly:\n${JSON.stringify({udc:groqResearch.udc, evidence:groqResearch.evidence, sources:groqResearch.sources})}\n\nUse Google Search grounding yourself. Independently verify the candidate against authoritative/reputable UDC evidence. Gemini MUST make the final decision. If verified, return JSON only using the required format.`;
        const resp=await ai.models.generateContent({
          model:geminiModel, contents:reviewPrompt,
          config:{tools:[{googleSearch:{}}]}
        });
        const parsed=extractJSON(resp.text);
        const sources=groundingSources(resp);
        if(validAiResult(parsed,sources)) {
          return res.json(cleanResult({...parsed,sources},title,"gemini"));
        }
      } catch(e) {
        geminiQuota ||= isQuotaError(e);
        console.error("Gemini final review:",e.message);
      }
    }
  }

  // 4) Clean unresolved state. Never send 0, a Groq final, a fake UDC, or
  //    raw provider quota text to the browser.
  return res.json({
    verified:false,title,
    message: geminiQuota
      ? "Gemini could not complete final verification because of quota/rate limits. Groq was used only for research and was not shown as the final answer. No UDC number was invented."
      : "Gemini could not independently verify a reliable UDC classification. Groq research was not used as a final answer. No UDC number was invented.",
    providerStatus:"VERIFICATION REQUIRED",
    verificationLabel:"GEMINI FINAL VERIFICATION REQUIRED",
    sources:[]
  });
});

app.use((req,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.listen(port,()=>console.log(`UDC Ultimate V24.1 running on port ${port}`));
