import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({limit:"1mb"}));
app.use(express.static(__dirname));
const PORT = process.env.PORT || 10000;
const GROQ_KEY = process.env.GROQ_API_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const MODELS = [process.env.GEMINI_MODEL,process.env.GEMINI_PRO_MODEL,"gemini-3.8-flash","gemini-3.7-flash","gemini-3.6-flash","gemini-3.5-flash","gemini-3.5-flash-lite","gemini-2.5-flash" ].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
const UDC_SOURCE_FILE=path.join(__dirname,"UDC_BS1000A_1961_FULL.txt");
const UDC_SOURCE_PDF=path.join(__dirname,"UDC_BS1000A_1961.pdf");
const UDC_SOURCE_TEXT=fs.existsSync(UDC_SOURCE_FILE)?fs.readFileSync(UDC_SOURCE_FILE,"utf8"):"";
const UDC_SOURCE_PAGES=UDC_SOURCE_TEXT.split("\f");
const UDC_SOURCE_TITLE="Universal Decimal Classification — B.S. 1000A:1961, Abridged English Edition, 3rd Edition Revised 1961";

const UDC_RULES=`
Universal Decimal Classification ONLY. Never DDC.
PRIMARY AUTHORITY: the bundled uploaded UDC source: ${UDC_SOURCE_TITLE}. Treat this uploaded edition as the controlling source for class numbers, auxiliaries, terminology, hierarchy and notation whenever it contains the needed entry. Do not silently substitute modern UDC, UDC Summary, DDC, or another edition.
Use the uploaded UDC tables/index first. Verify a candidate against the systematic tables, not the alphabetical index alone. Follow the book's own notation and terminology. Use auxiliaries only when supported by the uploaded edition and justified by the title.
The uploaded source is a 1961 abridged English UDC edition. Historical notation can differ from current UDC; preserve the uploaded edition rather than modernizing it.
Never invent a class that is absent from the uploaded source. If the uploaded source does not support an exact final number, say that verification is required rather than replacing it with a modern number.
Never return DDC, 0, blank, null or N/A.
`;

function localUDCEvidence(title){
  if(!UDC_SOURCE_TEXT) return {snippets:[],pages:[]};
  const q=String(title||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
  const terms=[...new Set(q.split(/\s+/).filter(w=>w.length>=4 && !/^(book|the|and|for|with|from|into|about|this|that)$/i.test(w)))];
  const scored=[];
  for(let i=0;i<UDC_SOURCE_PAGES.length;i++){
    const page=UDC_SOURCE_PAGES[i]; const low=page.toLowerCase();
    let score=0; for(const term of terms) if(low.includes(term)) score++;
    if(score) scored.push({i,score,page});
  }
  scored.sort((a,b)=>b.score-a.score || a.i-b.i);
  const top=scored.slice(0,5);
  return {pages:top.map(x=>x.i+1),snippets:top.map(x=>`[Uploaded UDC PDF page ${x.i+1}]\n${x.page.slice(0,4500)}`)};
}


const schema={type:"object",properties:{title:{type:"string"},udc_number:{type:"string"},main_subject:{type:"string"},sub_subject:{type:"string"},explanation:{type:"string"},breakdown:{type:"string"},confidence:{type:"string"},evidence_summary:{type:"string"},sources:{type:"array",items:{type:"string"}},evidence_level:{type:"string"},official_udc_match:{type:"boolean"},candidate_notes:{type:"string"},notation_check:{type:"string"}},required:["title","udc_number","main_subject","sub_subject","explanation","breakdown","confidence","evidence_summary","sources","evidence_level","official_udc_match","candidate_notes","notation_check"]};

function norm(s){return String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim()}
function parseJSON(s){if(!s)throw Error("Empty AI response");s=String(s).replace(/^```json\s*/i,"").replace(/^```\s*/,"").replace(/```\s*$/i,"").trim();const a=s.indexOf("{"),b=s.lastIndexOf("}");if(a>=0&&b>a)s=s.slice(a,b+1);return JSON.parse(s)}
function validate(r,title){const n=String(r?.udc_number||"").trim();if(!n||n==="0"||/^unknown|null|n\/a$/i.test(n))throw Error("Invalid UDC number");if(n.includes("004")&&!/(computer|computing|informatics|information technology|software|programming|data processing|artificial intelligence|machine learning|cyber|internet|database|ict)/i.test(title))throw Error("SEMANTIC_GUARD_004");return {...r,title:r?.title||title,udc_number:n,sources:Array.isArray(r?.sources)?r.sources.filter(Boolean).slice(0,8):[],official_udc_match:!!r?.official_udc_match}};

function localClassify(title){
  const ev=localUDCEvidence(title);
  return result(title,"—","Unresolved subject","Requires uploaded UDC verification",`No deterministic exact notation is hard-coded for this title. The classifier must use the bundled ${UDC_SOURCE_TITLE} evidence before assigning a final number. Retrieved pages: ${ev.pages.length?ev.pages.join(", "):"none"}.`,"Needs uploaded UDC verification",false,ev.pages);
}
function result(title,n,m,s,x,conf,official,pages=[]){return{title,udc_number:n,main_subject:m,sub_subject:s,breakdown:x,explanation:x+(official?"":" Final classification must be grounded in the bundled uploaded UDC edition."),confidence:conf,evidence_summary:official?"Verified against the bundled uploaded UDC edition.":"Awaiting verification against the bundled uploaded UDC edition.",sources:["Bundled uploaded UDC: B.S. 1000A:1961, 3rd Edition Revised 1961"],evidence_level:conf,official_udc_match:official,candidate_notes:"",notation_check:"Every displayed component must be supported by the uploaded UDC B.S. 1000A:1961 tables; no DDC or modern replacement notation is used.",engine:"V45 ULTRA uploaded-UDC engine",model:"offline",grounded:false,uploaded_udc_pages:pages}}

async function gemini(title,model,grounded){const ev=localUDCEvidence(title);const evidence=ev.snippets.join("\n\n");const body={contents:[{role:"user",parts:[{text:`${UDC_RULES}\nClassify this complete book title: "${title}". Use the uploaded UDC edition as the primary and controlling authority. The following retrieved pages are evidence from that exact uploaded book; inspect them and follow their printed numbers/terminology. Do not modernize them. Generate up to 3 candidates internally, audit every notation component and every language/place/form/time auxiliary against the uploaded evidence, then return one final result. Never convert a subject to a broader class merely because a model guess is convenient. Do not invent an official record. JSON only.\n\nUPLOADED UDC EVIDENCE:\n${evidence}` }]}],systemInstruction:{parts:[{text:UDC_RULES}]},generationConfig:{temperature:0.02,responseMimeType:"application/json",responseSchema:schema,maxOutputTokens:1600}};if(grounded)body.tools=[{googleSearch:{}}];const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),28000);try{const u=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;const r=await fetch(u,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":GEMINI_KEY},body:JSON.stringify(body),signal:ac.signal});const txt=await r.text();let j;try{j=JSON.parse(txt)}catch{throw Error("Bad Gemini response")};if(!r.ok)throw Error(j?.error?.message||`Gemini HTTP ${r.status}`);const out=validate(parseJSON(j?.candidates?.[0]?.content?.parts?.map(x=>x.text||"").join("")),title);const chunks=j?.candidates?.[0]?.groundingMetadata?.groundingChunks||[];const gs=chunks.map(x=>x.web).filter(Boolean).map(x=>x.uri).filter(Boolean);if(!out.sources.length)out.sources=[];out.sources.unshift("Bundled uploaded UDC: B.S. 1000A:1961, 3rd Edition Revised 1961");return{...out,engine:grounded?"Gemini + uploaded UDC + Google Search":"Gemini + uploaded UDC",model,grounded:gs.length>0,uploaded_udc_pages:ev.pages}}finally{clearTimeout(tm)}}
async function groq(title){if(!GROQ_KEY)throw Error("GROQ_API_KEY not configured");const ev=localUDCEvidence(title);const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${GROQ_KEY}`},body:JSON.stringify({model:process.env.GROQ_MODEL||"openai/gpt-oss-120b",temperature:0.02,response_format:{type:"json_object"},messages:[{role:"system",content:UDC_RULES},{role:"user",content:`Classify "${title}" using ONLY the uploaded UDC edition as primary authority. Inspect these retrieved pages from the exact uploaded book and preserve their historical notation. Return the required JSON fields only. Never use DDC or silently substitute modern UDC.\n\nUPLOADED UDC EVIDENCE:\n${ev.snippets.join("\n\n")}`}]})});const j=await r.json();if(!r.ok)throw Error(j?.error?.message||`Groq HTTP ${r.status}`);return{...validate(parseJSON(j?.choices?.[0]?.message?.content||""),title),engine:"Groq fallback",model:process.env.GROQ_MODEL||"openai/gpt-oss-120b",grounded:false}}

app.get("/",(_,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.get("/api/health",(_,res)=>res.json({ok:true,version:"V45 ULTRA",geminiConfigured:!!GEMINI_KEY,groqConfigured:!!GROQ_KEY,models:MODELS,authority:UDC_SOURCE_TITLE,uploadedUDC:!!UDC_SOURCE_TEXT,uploadedUDCPages:UDC_SOURCE_PAGES.length}));
app.post("/api/classify",async(req,res)=>{const title=String(req.body?.title||"").trim();if(!title)return res.status(400).json({error:"Enter a book title."});
 // Deterministic exact/high-value rules run first: this prevents AI drift on known titles.
 const lc=localClassify(title); if(lc.official_udc_match) return res.json(lc);
 const errors=[];
 if(GEMINI_KEY){for(const grounded of [true,false])for(const model of MODELS){try{return res.json(await gemini(title,model,grounded))}catch(e){errors.push(`${model}/${grounded?'search':'plain'}: ${e.message}`)}}}
 if(GROQ_KEY){try{return res.json(await groq(title))}catch(e){errors.push(`groq: ${e.message}`)}}
 lc.provider_errors=errors.slice(-8);lc.engine="V45 ULTRA deterministic safety-net";lc.evidence_level="BEST_EFFORT";lc.confidence="Best effort — verify against the uploaded UDC B.S. 1000A:1961 source";return res.json(lc);
});
app.listen(PORT,()=>console.log(`UDC V45 ULTRA on ${PORT}`));
