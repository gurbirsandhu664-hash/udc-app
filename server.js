import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({limit:"1mb"}));
app.use(express.static(__dirname));
const PORT = process.env.PORT || 10000;

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-2.5-flash",
  "gemini-2.5-pro"
].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);

const UDC_RULES = `
UDC MASTER RULES:
- Universal Decimal Classification ONLY. Never DDC.
- UDC is hierarchical and analytico-synthetic. Main classes are 0 Knowledge/Computer Science/Information, 1 Philosophy/Psychology, 2 Religion, 3 Social Sciences, 4 vacant, 5 Mathematics/Natural Sciences, 6 Applied Sciences/Medicine/Technology, 7 Arts/Entertainment/Sport, 8 Linguistics/Literature, 9 Geography/History.
- 004 is specifically Computer science and technology / Computing / Data processing. NEVER select 004 merely because a title contains "technology", "technical", "digital", "tool", "method", "application", "science", or "and".
- 5 and 6 must be semantically distinguished: natural sciences versus applied sciences/medicine/technology.
- "and" is not itself a UDC operator. Choose +, :, /, :: or another construction only when the relationship described by the title and UDC syntax justify it.
- + means coordination/addition; / consecutive extension; : simple relation; :: order-fixing; [] subgrouping.
- Common auxiliaries include language =..., form (0...), place (1/9), ethnic/nationality (=...), time "...", general characteristics -0...; use only when justified.
- Special auxiliaries are local to their designated subject areas and may use .0, - or '.
- A compound expression must be syntactically valid and explainable as component UDC concepts.
- Do not fabricate an "official" match. If exact UDC evidence is not available, return the best reasoned UDC classification with lower confidence and say it is reasoned.
- Never return blank, null, "unknown", "N/A", or 0 as the UDC number.
`;

const schema = {
 type:"object",
 properties:{
  title:{type:"string"},
  udc_number:{type:"string"},
  main_subject:{type:"string"},
  sub_subject:{type:"string"},
  explanation:{type:"string"},
  breakdown:{type:"string"},
  confidence:{type:"string"},
  evidence_summary:{type:"string"},
  sources:{type:"array",items:{type:"string"}}
 },
 required:["title","udc_number","main_subject","sub_subject","explanation","breakdown","confidence","evidence_summary","sources"]
};

function parseJSON(s){
 if(!s) throw new Error("Empty Gemini response");
 s=String(s).replace(/^```json\s*/i,"").replace(/^```\s*/,"").replace(/```\s*$/,"").trim();
 const a=s.indexOf("{"), b=s.lastIndexOf("}");
 if(a>=0 && b>a) s=s.slice(a,b+1);
 return JSON.parse(s);
}

function validate(r,title){
 const n=String(r?.udc_number||"").trim();
 if(!n || n==="0" || /^unknown|null|n\/a$/i.test(n)) throw new Error("Invalid UDC number");
 if(/[A-Za-z]/.test(n) && !/^[0-9.()+:\/\[\]'"=\-*; ]+$/.test(n)) throw new Error("Invalid UDC notation");
 // Semantic guard against the recurring false 004 result.
 const t=title.toLowerCase();
 const computerTerms=/(computer|computing|informatics|information technology|software|programming|data processing|artificial intelligence|machine learning|cyber|internet|database|ict|digital technology)/i;
 if(n.includes("004") && !computerTerms.test(t)){
   throw new Error("SEMANTIC_GUARD_REJECTED_004");
 }
 return {
  title:r?.title||title,
  udc_number:n,
  main_subject:r?.main_subject||"",
  sub_subject:r?.sub_subject||"",
  explanation:r?.explanation||"",
  breakdown:r?.breakdown||"",
  confidence:r?.confidence||"Medium",
  evidence_summary:r?.evidence_summary||"",
  sources:Array.isArray(r?.sources)?r.sources.filter(Boolean).slice(0,8):[]
 };
}

function makePrompt(title){
 return `${UDC_RULES}

TASK:
Classify this complete book title:
"${title}"

First identify the actual subject(s), then select the most specific UDC class available from the UDC knowledge you can establish.
Do not map words mechanically. In particular, "technology" does not imply 004.
If the title covers two subjects, decide whether UDC coordination (+), relation (:), extension (/), or a single broader class is appropriate.
Use auxiliaries only where supported.
Return one final UDC notation, a component breakdown, and an honest confidence level.
Return JSON only.`;
}

async function gemini(title,model,grounded){
 const body={
  contents:[{role:"user",parts:[{text:makePrompt(title)}]}],
  systemInstruction:{parts:[{text:UDC_RULES}]},
  generationConfig:{temperature:0.05,responseMimeType:"application/json",responseSchema:schema,maxOutputTokens:1400}
 };
 if(grounded) body.tools=[{googleSearchRetrieval:{dynamicRetrievalConfig:{mode:"MODE_DYNAMIC",dynamicThreshold:0.25}}}];
 const ac=new AbortController(); const tm=setTimeout(()=>ac.abort(),30000);
 try{
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":GEMINI_KEY},body:JSON.stringify(body),signal:ac.signal});
  const txt=await r.text(); let j; try{j=JSON.parse(txt)}catch{throw new Error("Bad Gemini response")};
  if(!r.ok) throw new Error(j?.error?.message||`Gemini HTTP ${r.status}`);
  const text=j?.candidates?.[0]?.content?.parts?.map(x=>x.text||"").join("")||"";
  const out=validate(parseJSON(text),title);
  const chunks=j?.candidates?.[0]?.groundingMetadata?.groundingChunks||[];
  const groundedSources=chunks.map(x=>x.web).filter(Boolean).map(x=>x.uri).filter(Boolean);
  if(!out.sources.length) out.sources=groundedSources.slice(0,8);
  return {...out,engine:grounded?"Gemini + Google Search":"Gemini fallback",model,grounded:groundedSources.length>0};
 }finally{clearTimeout(tm)}
}

app.get("/",(_,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.get("/api/health",(_,res)=>res.json({ok:true,version:"V41",geminiConfigured:!!GEMINI_KEY,models:MODELS}));

app.post("/api/classify",async(req,res)=>{
 const title=String(req.body?.title||"").trim();
 if(!title) return res.status(400).json({error:"Enter a book title."});
 if(!GEMINI_KEY) return res.status(503).json({error:"GEMINI_API_KEY missing. Add it in Render Environment Variables."});
 const errors=[];
 for(const grounded of [true,false]){
  for(const model of MODELS){
   try{return res.json(await gemini(title,model,grounded))}
   catch(e){errors.push(`${model}/${grounded?"search":"fallback"}: ${e.message}`)}
  }
 }
 return res.status(502).json({
  error:"Classification paths exhausted",
  detail:errors.slice(-8).join(" | "),
  message:"No guessed UDC number was returned. Check Gemini API key/quota/model access."
 });
});

app.listen(PORT,()=>console.log(`UDC V41 on ${PORT}`));
