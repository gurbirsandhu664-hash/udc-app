import express from "express";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

const app = express();
app.disable("x-powered-by");
app.use(express.json({limit:"128kb"}));
app.use(express.static("."));

const PORT = Number(process.env.PORT || 10000);
const uniq = xs => [...new Set(xs.map(v=>String(v??"").trim()).filter(Boolean))];
function envKeys(name){
  return uniq([
    ...(process.env[`${name}_KEYS`]||"").split(","),
    process.env[`${name}_KEY`]||"",
    name === "GEMINI" ? (process.env.GOOGLE_AI_STUDIO_KEY||"") : ""
  ]);
}
function geminiKeys(){return envKeys("GEMINI")}
function groqKeys(){return envKeys("GROQ")}
function geminiModels(){
  return uniq((process.env.GEMINI_MODELS||"gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite").split(","));
}
const GROQ_MODEL = process.env.GROQ_MODEL || "groq/compound";
const TIMEOUT = Number(process.env.REQUEST_TIMEOUT_MS || 45000);
const ATTEMPTS = Math.max(1, Math.min(2, Number(process.env.GEMINI_ATTEMPTS_PER_COMBINATION || 1)));

const OFFICIAL_UDC = "https://udcsummary.info/";
const OFFICIAL_UDCC = "https://udcc.org/";

const UDC_RULES = `
You are the FINAL Universal Decimal Classification (UDC) classifier for a professional library tool.

AUTHORITY AND SCOPE
- UDC ONLY. NEVER DDC.
- Use the UDC Summary / UDC Consortium as the primary authority.
- UDC Summary is an abridged selection (about 2,600 classes); the full UDC scheme has 70,000+ entries. Do not pretend the Summary contains every full-schedule detail.
- If the title requires a number that is not explicitly present in the Summary, derive it ONLY when the needed components are supported by authoritative UDC evidence and valid UDC synthesis rules.

CLASSIFICATION METHOD
1. Interpret the whole title and likely document subject; do not classify from one keyword.
2. Find the closest UDC concept/hierarchy in authoritative web evidence.
3. Consider main class, subordinate class, common auxiliaries and permitted special auxiliaries.
4. Apply synthesis only where UDC syntax permits it: relation signs, language, form, place, time, ethnic/nationality and other auxiliaries as supported by the schedule.
5. For literature, distinguish language, literature, literary form and subject where the UDC evidence supports that distinction.
6. Do not confuse a subject number with a common auxiliary. Do not invent an auxiliary.
7. Prefer the most specific supported notation, but never make specificity up.
8. If an exact class is found, use it. If a defensible synthesis is found, label evidenceLevel SYNTHESIZED.
9. NEVER output 0, 000, a DDC number, a made-up code, or a placeholder as a classification.
10. If evidence is insufficient, return verified=false and udc="". Do not force an answer.

QUALITY CONTROL
- Before returning JSON, internally check that every component of the proposed notation is supported by UDC evidence and that the syntax is valid.
- Do not cite random blogs as authority when official UDC evidence is available.
- Google Search grounding is evidence gathering, not permission to guess.

OUTPUT: JSON only, exactly:
{
  "verified": true|false,
  "udc": "",
  "title": "",
  "mainSubject": "",
  "subSubject": "",
  "explanation": "",
  "confidence": "High|Medium|Low",
  "evidenceLevel": "DIRECT|SYNTHESIZED",
  "sources": [{"title":"","url":""}]
}
`;

function parseJSON(text){
  let s=String(text||"").trim();
  s=s.replace(/^```(?:json)?\s*/i,"").replace(/```$/i,"").trim();
  try{return JSON.parse(s)}catch{}
  const a=s.indexOf("{"), b=s.lastIndexOf("}");
  if(a>=0 && b>a){try{return JSON.parse(s.slice(a,b+1))}catch{}}
  return null;
}
function validUDC(n){
  if(typeof n!=="string") return false;
  n=n.trim();
  if(!n || n==="0" || n==="000" || /\bddc\b/i.test(n)) return false;
  return /^[0-9][0-9A-Za-z.=:'"()+\-\/\[\]*]*$/.test(n);
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function withTimeout(p, ms=TIMEOUT){
  let t;
  const timeout=new Promise((_,rej)=>t=setTimeout(()=>rej(new Error("TIMEOUT")),ms));
  try{return await Promise.race([p,timeout])}finally{clearTimeout(t)}
}
function cleanSources(xs){
  const out=[];
  for(const x of xs||[]){
    if(!x) continue;
    const url=String(x.url||x.uri||"").trim();
    if(!/^https?:\/\//i.test(url)) continue;
    out.push({title:String(x.title||url).trim(),url});
  }
  return uniq(out.map(x=>JSON.stringify(x))).map(x=>JSON.parse(x)).slice(0,12);
}

async function googleCSE(title){
  const key=process.env.GOOGLE_CSE_KEY, cx=process.env.GOOGLE_CSE_ID;
  if(!key||!cx) return [];
  const q=encodeURIComponent(`"${title}" UDC "Universal Decimal Classification"`);
  const url=`https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&q=${q}`;
  try{
    const r=await withTimeout(fetch(url,{headers:{Accept:"application/json"}}),15000);
    if(!r.ok) return [];
    const d=await r.json();
    return (d.items||[]).slice(0,8).map(x=>({title:x.title||"",url:x.link||"",snippet:x.snippet||""}));
  }catch{return []}
}

async function groqResearch(title, evidence){
  if(!groqKeys().length) return "";
  const prompt=`Research only. Do NOT provide a final answer to the user. Identify authoritative UDC concepts, possible hierarchy paths, auxiliaries and evidence for this title. Flag uncertainty. Prefer official UDC sources.\nTITLE: ${title}\nWEB EVIDENCE: ${JSON.stringify(evidence).slice(0,12000)}`;
  for(const key of groqKeys()){
    try{
      const g=new Groq({apiKey:key});
      const r=await withTimeout(g.chat.completions.create({
        model:GROQ_MODEL,temperature:0,
        messages:[
          {role:"system",content:"You are a UDC research assistant. Groq output is research notes only and must never be used as the final displayed classification."},
          {role:"user",content:prompt}
        ]
      }),25000);
      return String(r?.choices?.[0]?.message?.content||"").slice(0,14000);
    }catch(e){console.log("Groq research failed; rotating key:",String(e?.message||e).slice(0,180))}
  }
  return "";
}

function groundingSources(resp){
  const chunks=resp?.candidates?.[0]?.groundingMetadata?.groundingChunks||[];
  return cleanSources(chunks.map(c=>c?.web?{title:c.web.title,url:c.web.uri}:null));
}

async function geminiFinal(key, model, title, evidence, research){
  const ai=new GoogleGenAI({apiKey:key});
  const prompt=`${UDC_RULES}\n\nOFFICIAL UDC SUMMARY: ${OFFICIAL_UDC}\nOFFICIAL UDC CONSORTIUM: ${OFFICIAL_UDCC}\n\nTITLE:\n${title}\n\nOPTIONAL GOOGLE SEARCH EVIDENCE:\n${JSON.stringify(evidence).slice(0,14000)}\n\nGROQ RESEARCH NOTES (UNTRUSTED; VERIFY):\n${research.slice(0,12000)}\n\nFINAL TASK\n- Use Google Search grounding to locate authoritative UDC evidence, especially UDC Summary / UDC Consortium pages.\n- Compare candidate concepts before selecting the notation.\n- Return only the requested JSON.\n- If you cannot verify a defensible UDC notation, return verified=false and an empty udc.`;
  const resp=await withTimeout(ai.models.generateContent({
    model,
    contents:prompt,
    config:{tools:[{googleSearch:{}}],temperature:0.05}
  }));
  const j=parseJSON(resp?.text);
  if(!j) throw new Error("INVALID_JSON");
  const sources=cleanSources([...(j.sources||[]),...groundingSources(resp)]);
  if(j.verified===false || !j.udc) return {...j,verified:false,udc:"",title:j.title||title,sources};
  if(!validUDC(j.udc)) throw new Error("INVALID_UDC");
  return {...j,verified:true,title:j.title||title,sources};
}

app.get("/api/health",(req,res)=>res.json({
  ok:true,version:"V30-STABLE",finalProvider:"Gemini",researchProvider:groqKeys().length?"Groq":"none",
  geminiKeys:geminiKeys().length,geminiModels:geminiModels(),groqKeys:groqKeys().length,
  googleCSE:Boolean(process.env.GOOGLE_CSE_KEY&&process.env.GOOGLE_CSE_ID)
}));

app.post("/api/classify",async(req,res)=>{
  const title=String(req.body?.title||"").replace(/\s+/g," ").trim();
  if(!title) return res.status(400).json({ok:false,verified:false,status:"EMPTY_TITLE",message:"Enter a book title."});
  if(title.length>500) return res.status(400).json({ok:false,verified:false,status:"TITLE_TOO_LONG",message:"Please enter a shorter title (maximum 500 characters)."});

  const evidence=await googleCSE(title);
  const research=await groqResearch(title,evidence);
  const keys=geminiKeys();
  const models=geminiModels();
  if(!keys.length){
    return res.json({ok:false,verified:false,status:"GEMINI_KEY_MISSING",title,message:"Google AI Studio/Gemini API key is not configured. No UDC number was invented."});
  }

  let lastReason="";
  for(const key of keys){
    for(const model of models){
      for(let attempt=0;attempt<ATTEMPTS;attempt++){
        try{
          const j=await geminiFinal(key,model,title,evidence,research);
          if(!j.verified){
            return res.json({ok:false,verified:false,status:"NO_VERIFIED_RESULT",title,
              message:"No defensible UDC classification could be verified from the available UDC evidence. No number was invented.",
              sources:j.sources||[],provider:"Gemini FINAL"});
          }
          return res.json({ok:true,verified:true,status:"VERIFIED",provider:"Gemini FINAL",model,...j});
        }catch(e){
          lastReason=String(e?.message||e).slice(0,200);
          console.log(`Gemini attempt failed (${model}):`,lastReason);
          await sleep(250);
        }
      }
    }
  }
  return res.json({ok:false,verified:false,status:"GEMINI_UNAVAILABLE",title,
    message:"Gemini final verification is temporarily unavailable (quota, rate limit, model, or network). The app did not substitute Groq, DDC, 0, or a guessed UDC number.",
    detail:process.env.NODE_ENV==="development"?lastReason:undefined,sources:evidence});
});

app.get("/*splat",(req,res)=>res.sendFile(process.cwd()+"/index.html"));
app.listen(PORT,()=>console.log(`UDC Search Engine V30-STABLE listening on ${PORT}`));
