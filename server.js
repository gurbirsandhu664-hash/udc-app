const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(express.json({limit:"64kb"}));
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 10000;
// Current high-reasoning model; can be overridden in Render without changing code.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";

const SYSTEM = `
You are TITAN, a rigorous Universal Decimal Classification (UDC) research/classification engine.

PRIMARY RULE: UDC ONLY. NEVER use Dewey Decimal Classification (DDC), Library of Congress, Colon Classification, or another scheme as the answer.

MISSION:
Given a book title, determine the most defensible UDC classmark. Use the complete semantic meaning of the title, not keyword matching.

RESEARCH PROTOCOL:
A. Parse the title into subject, object, process/method, population/person, place, time, language, literary form, document form, material, relation and other facets where explicitly supported.
B. Generate multiple plausible UDC candidates internally.
C. Use Google Search grounding to look for evidence. Prefer:
   1) UDC Consortium (udcc.org) for UDC structure, notation and terminology.
   2) Authorized/licensed UDC schedules or trusted library catalogues that explicitly display UDC.
   3) Other reputable sources only as corroboration.
D. Distinguish a source that explains UDC structure from a source that actually supports a particular classmark.
E. Never claim that a source supports a number unless the evidence actually supports that number.
F. If an exact classmark cannot be supported, still provide the best-supported candidate only when the evidence is strong enough; otherwise use "REQUIRES VERIFICATION". Do not manufacture certainty.
G. A classmark that is merely a broad parent is not automatically correct if the title clearly identifies a more specific concept.
H. Apply UDC syntax correctly. UDC linking signs include +, /, :, :: and []; * and A/Z introduce non-UDC notation. Common auxiliaries include language =..., form (0...), place (1/9), ethnic/nationality (=...), time "..." and general characteristics -0...; special auxiliaries begin with .0, - or ' within their designated subject areas. Do not apply an auxiliary without checking that it belongs in that context.
I. For literature: distinguish language, literature, genre/form and literary study; do not confuse the language of the work with literature about that language.
J. For dictionaries/encyclopedias/handbooks/manuals: distinguish subject from document form and use form auxiliaries only when actually justified.
K. For geography/history: place and time may be crucial; verify place auxiliaries rather than guessing.
L. For medicine: distinguish the broad medical sciences class from specific diseases, anatomy, diagnosis, therapy, etc. Do not use a generic medicine class simply because the title is medical.
M. For science/technology: identify the actual material/process/device/field before selecting a parent class.
N. Do not convert a DDC number into a UDC-looking number.

OUTPUT:
Return one JSON object only with:
{
 "udc": "best supported classmark or REQUIRES VERIFICATION",
 "title": "...",
 "subject": "...",
 "sub_subject": "...",
 "context": "...",
 "breakdown": ["component — meaning", "..."],
 "explanation": "concise but technically specific reasoning",
 "confidence": "High|Medium|Low|Requires verification",
 "evidence_level": "...",
 "status": "...",
 "candidates": [{"udc":"...","reason":"...","verdict":"SUPPORTED|REJECTED|UNCERTAIN"}],
 "sources": [{"title":"...","url":"..."}],
 "warnings": ["..."]
}

IMPORTANT:
- Do not output markdown fences.
- Do not output DDC.
- Do not invent source URLs.
- If Google grounding supplies source URLs, the server will replace model-supplied sources with the actual grounding URLs.
`;

function clean(s){return String(s||"").replace(/^```json\s*/i,"").replace(/```\s*$/,"").trim()}
function parse(text){
  const t=clean(text);
  try{return JSON.parse(t)}catch(e){
    const m=t.match(/\{[\s\S]*\}/);
    if(!m)throw e;
    return JSON.parse(m[0]);
  }
}
function normalize(o,title){
  return {
    udc:String(o?.udc||"REQUIRES VERIFICATION").trim(),
    title,
    subject:String(o?.subject||"").trim(),
    sub_subject:String(o?.sub_subject||"").trim(),
    context:String(o?.context||"").trim(),
    breakdown:Array.isArray(o?.breakdown)?o.breakdown.map(String):[],
    explanation:String(o?.explanation||"").trim(),
    confidence:String(o?.confidence||"Requires verification").trim(),
    evidence_level:String(o?.evidence_level||"Not established").trim(),
    status:String(o?.status||"Requires verification").trim(),
    candidates:Array.isArray(o?.candidates)?o.candidates.slice(0,8):[],
    sources:Array.isArray(o?.sources)?o.sources:[],
    warnings:Array.isArray(o?.warnings)?o.warnings.map(String):[]
  }
}

/*
 Hard consistency checks target common failure modes seen in title-only classifiers.
 They do not replace the UDC schedules; they prevent obvious parent-class mistakes.
*/
function audit(title,o){
  const t=title.toLowerCase(), n=o.udc.replace(/\s+/g,"");
  const warnings=[];
  if(/\bheart disease\b|\bcardiovascular disease\b|\bcoronary disease\b|\bmyocardial\b|\bcardiac disease\b/.test(t) && /^61(?:[.(]|$)/.test(n)){
    warnings.push("Disease-specific medical title returned a broad 61 classmark; candidate requires verification against the 616 disease hierarchy.");
    o.udc="REQUIRES VERIFICATION"; o.confidence="Requires verification"; o.status="Rejected by consistency gate";
  }
  if(/\bhistory of india\b/.test(t) && !/^94\(540\)/.test(n)){
    warnings.push("The title explicitly identifies India; verify the geographic auxiliary before accepting a generic history number.");
    if(/^94$/.test(n)){o.udc="REQUIRES VERIFICATION";o.confidence="Requires verification";o.status="Rejected by consistency gate"}
  }
  if(/\bgeography of india\b/.test(t) && !/^91\(540\)/.test(n)){
    warnings.push("The title explicitly identifies India; verify the place auxiliary before accepting a generic geography number.");
    if(/^91$/.test(n)){o.udc="REQUIRES VERIFICATION";o.confidence="Requires verification";o.status="Rejected by consistency gate"}
  }
  if(/\bddc\b/.test(JSON.stringify(o))) {warnings.push("DDC terminology appeared in model output and was removed from the accepted evidence path.");}
  o.warnings=[...new Set([...(o.warnings||[]),...warnings])];
  return o;
}

async function runGemini(title){
  if(!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing in Render Environment Variables.");
  const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
  const prompt=SYSTEM+`\n\nTITLE TO CLASSIFY:\n"${title}"\n\nSearch the web when useful. Your answer must be UDC-specific and evidence-aware. Return JSON only.`;
  const response=await ai.models.generateContent({
    model:MODEL,
    contents:prompt,
    config:{
      tools:[{googleSearch:{}}],
      temperature:0.1
    }
  });
  let out=normalize(parse(response.text||""),title);

  // Replace any invented/unsupported source list with actual grounding URLs.
  const chunks=response.candidates?.[0]?.groundingMetadata?.groundingChunks||[];
  const actual=chunks.map(x=>x.web).filter(Boolean).map(w=>({title:w.title||"Google result",url:w.uri||""})).filter(x=>x.url);
  if(actual.length) out.sources=actual.slice(0,15);

  return audit(title,out);
}

app.post("/api/classify",async(req,res)=>{
  const title=String(req.body?.title||"").trim();
  if(!title)return res.status(400).json({error:"Book title is required."});
  try{
    const result=await runGemini(title);
    res.json(result);
  }catch(e){
    console.error("CLASSIFY_ERROR",e);
    res.status(502).json({error:"Gemini/Search classification failed.",detail:String(e.message||e)});
  }
});

// No local UDC seed database: practice questions are a tiny training interface,
// not a reference table. They are intentionally separated from classification.
const PRACTICE=[
 ["History of India","94(540)","94 — History; (540) — India"],
 ["Geography of India","91(540)","91 — Geography; (540) — India"],
 ["Indian Constitution","342(540)","342 — Constitutional law; (540) — India"],
 ["Economy of India","330(540)","330 — Economics; (540) — India"],
 ["History of Punjab","94(540.15)","94 — History; (540.15) — Punjab"]
];
app.get("/api/practice",(req,res)=>{
  const x=PRACTICE[Math.floor(Math.random()*PRACTICE.length)];
  res.json({title:x[0],udc:x[1],explanation:x[2]});
});

app.get("/api/health",(req,res)=>res.json({
  ok:true,
  version:"UDC-TITAN-48.2",
  model:MODEL,
  geminiConfigured:Boolean(process.env.GEMINI_API_KEY),
  googleSearchGrounding:true,
  seedReference:false,
  serverTime:new Date().toISOString()
}));

app.listen(PORT,()=>console.log(`UDC TITAN listening on ${PORT} using ${MODEL}`));
