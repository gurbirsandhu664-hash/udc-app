import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "256kb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const GROQ_KEY = process.env.GROQ_API_KEY || "";
const GEMINI_MODELS = [...new Set([
  process.env.GEMINI_MODEL || "gemini-3.8-flash",
  process.env.GEMINI_FALLBACK_MODEL || "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-2.5-flash"
])];
const SUMMARY_URL = "https://udcsummary.info/";
const UDC_URL = "https://udcc.org/";

const RULES = `
You are the UDC One-Click V48 ULTRA classification engine.
CLASSIFICATION SYSTEM: Universal Decimal Classification (UDC) ONLY. NEVER DDC.

MISSION
Classify a complete book title as accurately as the available evidence permits. Do not classify from one keyword alone. Determine the subject/concept and then construct/check UDC notation.

UDC WORKFLOW
A. Parse the title semantically: subject, object, action/process, material, language, literary form, place, time, person/group, document form, and relationships.
B. Identify the principal subject and candidate UDC main class.
C. Search for the exact/closest UDC class in authoritative or reliable sources, prioritizing UDC Consortium material and UDC Summary.
D. Generate up to 3 plausible candidate classmarks internally.
E. Audit every digit, decimal, auxiliary and connecting sign.
F. Reject any candidate that cannot be justified by the evidence.
G. Return one final classmark, or REQUIRES VERIFICATION if the evidence is insufficient.

UDC STRUCTURE
Main classes:
0 Science and knowledge. Computer science. Information and documentation.
1 Philosophy. Psychology.
2 Religion. Theology.
3 Social sciences.
4 Vacant.
5 Mathematics and natural sciences.
6 Applied sciences. Medicine. Technology.
7 Arts. Entertainment. Sport.
8 Language. Linguistics. Literature.
9 Geography. Biography. History.

NOTATION / AUXILIARY AUDIT
Respect UDC syntax and never add a notation element merely because it exists:
+ coordination
/ consecutive extension
: simple relation
:: order-fixing relation
[] subgrouping
* non-UDC notation / externally assigned notation
A/Z alphabetical specification
Common auxiliaries may include language =..., form (0...), place (1/9), ethnicity/nationality (=...), time "..." and general characteristics -0...
Special auxiliaries are only valid inside the schedules where they are defined.
Every auxiliary MUST be justified by title/context and the relevant UDC schedule/evidence.

CRITICAL GUARDS
- Never output a DDC number.
- Never call a number "official" unless the evidence actually supports that exact classmark.
- Do not infer a detailed place, language, time or form auxiliary when the title does not support it.
- Do not use 004 merely because a title contains words such as technology, technical, digital, system, tool, method, application or science. 004 is for the actual computing/information-technology subject area.
- For multi-concept titles, distinguish coordination (+) from relation (:) and extension (/); do not mechanically concatenate numbers.
- For literary titles, separately analyze language and literary form.
- For reference works such as dictionaries, encyclopedias, handbooks and manuals, classify according to the actual subject/scope and UDC form treatment when supported.
- If the exact MRF-level notation cannot be verified from the accessible evidence, say so explicitly.
- Never use a made-up "72,000 classes" local JSON or claim to contain the licensed MRF. The application is an engine, not a reproduction of proprietary UDC data.

OUTPUT
Return JSON only with:
title, udc_number, main_subject, sub_subject, context, breakdown (array), explanation, confidence, evidence_level, official_udc_match (boolean), notation_check, candidate_notes, sources (array of {title,url,support}), engine
Confidence must be High, Medium, Low, or Requires verification.
`;

const schema = {
  type:"object",
  properties:{
    title:{type:"string"},
    udc_number:{type:"string"},
    main_subject:{type:"string"},
    sub_subject:{type:"string"},
    context:{type:"string"},
    breakdown:{type:"array",items:{type:"string"}},
    explanation:{type:"string"},
    confidence:{type:"string"},
    evidence_level:{type:"string"},
    official_udc_match:{type:"boolean"},
    notation_check:{type:"string"},
    candidate_notes:{type:"string"},
    sources:{type:"array",items:{type:"object",properties:{title:{type:"string"},url:{type:"string"},support:{type:"string"}},required:["title","url","support"]}},
    engine:{type:"string"}
  },
  required:["title","udc_number","main_subject","sub_subject","context","breakdown","explanation","confidence","evidence_level","official_udc_match","notation_check","candidate_notes","sources","engine"]
};

function cleanText(x){ return String(x ?? "").replace(/\s+/g," ").trim(); }
function norm(x){ return cleanText(x).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim(); }

function result(title, udc, main_subject, sub_subject, breakdown, explanation, confidence="Medium", official=false, note=""){
  return {
    title, udc_number:udc, main_subject, sub_subject, context:"",
    breakdown:Array.isArray(breakdown)?breakdown:[breakdown],
    explanation, confidence, evidence_level:official?"UDC-SUMMARY-MATCH":"DETERMINISTIC-UDC-RULE",
    official_udc_match:official,
    notation_check:"Audited deterministic rule; exact MRF authority should still be checked where stated.",
    candidate_notes:note,
    sources:[{title:"UDC Summary",url:SUMMARY_URL,support:"Public UDC reference used for hierarchy/context."}],
    engine:"V48 ULTRA deterministic layer"
  };
}

/*
  High-value deterministic rules. These are deliberately compact:
  they improve repeatability for common examples without pretending to be
  a complete UDC database.
*/
function deterministic(title){
  const t=norm(title);

  if(/^history of india$/.test(t))
    return result(title,"94(540)","History","History of India",["94 — History","(540) — India"],"94 is History and (540) is the place auxiliary for India.","High",true);
  if(/^geography of india$/.test(t))
    return result(title,"91(540)","Geography","Geography of India",["91 — Geography","(540) — India"],"91 is Geography and (540) is the place auxiliary for India.","High",true);
  if(/^indian constitution$/.test(t))
    return result(title,"342(540)","Law","Constitutional law of India",["342 — Constitutional law","(540) — India"],"342 is Constitutional law and (540) identifies India.","High",true);
  if(/^economy of india$/.test(t))
    return result(title,"330(540)","Economics","Economy of India",["330 — Economics","(540) — India"],"330 is Economics and (540) identifies India.","High",true);
  if(/^history of punjab$/.test(t))
    return result(title,"94(540.15)","History","History of Punjab",["94 — History","(540.15) — Punjab"],"94 is History and (540.15) is the place auxiliary for Punjab.","High",true);
  if(/^indian philosophy$/.test(t))
    return result(title,"1(540)","Philosophy","Philosophy in India",["1 — Philosophy","(540) — India"],"1 is Philosophy and (540) identifies India.","High",true);
  if(/^indian art$/.test(t))
    return result(title,"7(540)","Arts","Art in India",["7 — Arts","(540) — India"],"7 is Arts and (540) identifies India.","High",true);
  if(/^english drama$/.test(t))
    return result(title,"821.111-2","Literature","Drama in English",["821.111 — English literature","-2 — drama/form element"],"The title supplies both English literature and the dramatic form. Verify the exact current schedule entry before treating this as MRF-authoritative.","Medium",false);

  // Agriculture examples from the supplied V45 project, retained as explicit
  // rules rather than as a seed database.
  if(/^harvesting of wheat and maize$/.test(t))
    return result(title,"633.11+633.15:631.55","Agriculture","Harvesting of wheat and maize",["633.11 — wheat","633.15 — maize","+ — coordination",": — relation","631.55 — harvesting/gathering"],"The title contains two crops plus the harvesting operation. The rule expresses coordination of the crops and their relation to harvesting.","High",true);
  if(/^harvesting of wheat and barley$/.test(t))
    return result(title,"633.11+633.16:631.55","Agriculture","Harvesting of wheat and barley",["633.11 — wheat","633.16 — barley","+ — coordination",": — relation","631.55 — harvesting/gathering"],"The title contains two crops plus the harvesting operation.","High",true);
  if(/^harvesting of wheat$/.test(t))
    return result(title,"633.11:631.55","Agriculture","Harvesting of wheat",["633.11 — wheat",": — relation","631.55 — harvesting/gathering"],"The crop is wheat and the operation is harvesting.","High",true);
  if(/^harvesting of maize$/.test(t))
    return result(title,"633.15:631.55","Agriculture","Harvesting of maize",["633.15 — maize",": — relation","631.55 — harvesting/gathering"],"The crop is maize and the operation is harvesting.","High",true);
  if(/^harvesting of barley$/.test(t))
    return result(title,"633.16:631.55","Agriculture","Harvesting of barley",["633.16 — barley",": — relation","631.55 — harvesting/gathering"],"The crop is barley and the operation is harvesting.","High",true);

  return null;
}

function validate(out,title){
  if(!out || typeof out!=="object") throw new Error("Invalid AI object");
  const n=cleanText(out.udc_number);
  if(!n || /^(null|undefined|n\/a|unknown|0)$/i.test(n)) throw new Error("Missing UDC number");
  // Catch common DDC-style answers when they are plainly presented as DDC.
  if(/\bddc\b/i.test(JSON.stringify(out)) && !/\budc\b/i.test(JSON.stringify(out))) throw new Error("DDC output rejected");
  if(/004/.test(n) && !/(computer|computing|informatics|programming|software|database|cyber|artificial intelligence|machine learning|data processing|ict|information technology)/i.test(title))
    throw new Error("004 semantic guard rejected");
  out.title=title;
  out.breakdown=Array.isArray(out.breakdown)?out.breakdown.map(cleanText).filter(Boolean):[];
  out.sources=Array.isArray(out.sources)?out.sources.slice(0,10):[];
  return out;
}

async function geminiClassify(title, model, grounded, task){
  const ai=new GoogleGenAI({apiKey:GEMINI_KEY});
  const grounding = grounded ? [{googleSearch:{}}] : undefined;
  const prompt = `${RULES}

MODE: ${task}
TITLE: "${title}"

${grounded ? `Use Google Search grounding. Prefer these domains/targets when the search engine can find them:
- udcc.org
- udcsummary.info
- exact UDC classmark searches
- reputable library/catalogue records that explicitly display UDC
Search for the exact concept and notation, not just the title wording.` : `Use your internal knowledge only. Do not claim an exact classmark is official unless you can substantiate it.`}

Perform candidate generation and notation audit internally. Return only the required JSON.`;

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),30000);
  try{
    const response=await ai.models.generateContent({
      model,
      contents:prompt,
      config:{
        temperature:0.05,
        maxOutputTokens:2400,
        responseMimeType:"application/json",
        responseSchema:schema,
        ...(grounding ? {tools:grounding}: {})
      }
    });
    const text=response.text || "";
    let out;
    try { out=JSON.parse(text); } catch { throw new Error("Gemini returned invalid JSON"); }
    out=validate(out,title);
    const meta=response.candidates?.[0]?.groundingMetadata;
    const chunks=meta?.groundingChunks || [];
    const found=chunks.map(x=>x.web).filter(Boolean).map(x=>({title:x.title||x.domain||"Web source",url:x.uri,support:"Gemini Search grounding source"}));
    if(found.length) out.sources=[...out.sources,...found].filter((x,i,a)=>x.url&&a.findIndex(y=>y.url===x.url)===i).slice(0,10);
    out.engine=grounded?"Gemini 3.8 + Google Search":"Gemini fallback";
    out.grounded=Boolean(found.length);
    out.model=model;
    return out;
  } finally { clearTimeout(timeout); }
}

async function groqClassify(title){
  if(!GROQ_KEY) throw new Error("GROQ_API_KEY not configured");
  const body={
    model:process.env.GROQ_MODEL||"openai/gpt-oss-120b",
    temperature:0.05,
    response_format:{type:"json_object"},
    messages:[
      {role:"system",content:RULES},
      {role:"user",content:`Classify this title with the same candidate-generation and notation-audit workflow: "${title}". Return JSON only.`}
    ]
  };
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),30000);
  try{
    const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${GROQ_KEY}`},body:JSON.stringify(body),signal:controller.signal});
    const j=await r.json();if(!r.ok)throw new Error(j?.error?.message||`Groq HTTP ${r.status}`);
    const out=validate(JSON.parse(j.choices?.[0]?.message?.content||"{}"),title);
    out.engine="Groq fallback";out.model=body.model;out.grounded=false;
    return out;
  } finally {clearTimeout(timeout);}
}

app.get("/api/health",(_,res)=>res.json({
  ok:true,version:"48 ULTRA",authority:"UDC Summary",authorityUrl:SUMMARY_URL,
  geminiConfigured:Boolean(GEMINI_KEY),groqConfigured:Boolean(GROQ_KEY),
  geminiModels:GEMINI_MODELS
}));

app.post("/api/classify",async(req,res)=>{
  const title=cleanText(req.body?.title);
  if(!title) return res.status(400).json({error:"Enter a book title."});
  const exact=deterministic(title);
  if(exact) return res.json(exact);

  const errors=[];
  if(GEMINI_KEY){
    // Deep mode: grounded pass first, then non-grounded retry if the provider
    // rejects the tool/response schema combination.
    for(const model of GEMINI_MODELS){
      for(const grounded of [true,false]){
        try{
          const out=await geminiClassify(title,model,grounded,grounded?"SEARCH + VERIFY":"FALLBACK VERIFY");
          return res.json(out);
        }catch(e){ errors.push(`${model}/${grounded?"search":"plain"}: ${e.message}`); }
      }
    }
  }
  if(GROQ_KEY){
    try{return res.json(await groqClassify(title));}catch(e){errors.push(`groq: ${e.message}`);}
  }
  // Last-resort semantic answer: no seed JSON and no invented detailed class.
  const broad = /history|historical/i.test(title) ? ["94","History"] :
                /geograph/i.test(title) ? ["91","Geography"] :
                /philosoph/i.test(title) ? ["1","Philosophy"] :
                /religion|theology/i.test(title) ? ["2","Religion / Theology"] :
                /education|teaching|pedagogy/i.test(title) ? ["37","Education"] :
                /law|legal|constitution/i.test(title) ? ["34","Law"] :
                /mathemat|algebra|calculus/i.test(title) ? ["51","Mathematics"] :
                /physics/i.test(title) ? ["53","Physics"] :
                /chemistry/i.test(title) ? ["54","Chemistry"] :
                /biology|botany|zoology|ecology/i.test(title) ? ["57","Biological sciences"] :
                /medicine|medical|nursing/i.test(title) ? ["61","Medical sciences"] :
                /agriculture|crop|wheat|maize|farming/i.test(title) ? ["63","Agriculture"] :
                /architecture/i.test(title) ? ["72","Architecture"] :
                /music/i.test(title) ? ["78","Music"] :
                /literature|poetry|novel|fiction|drama/i.test(title) ? ["82","Literature"] :
                /language|linguistic|grammar|dictionary/i.test(title) ? ["81","Linguistics"] :
                null;
  if(broad){
    const out=result(title,broad[0],broad[1],"Broad subject only",[`${broad[0]} — ${broad[1]}`],
      "AI/Search services were unavailable. This is only a broad UDC subject fallback and must not be treated as an exact MRF classification.",
      "Requires verification",false,errors.slice(-4).join(" | "));
    out.evidence_level="FALLBACK";out.engine="V48 ULTRA semantic safety net";out.provider_errors=errors.slice(-6);
    return res.json(out);
  }
  res.status(503).json({error:"No classification provider is available.",provider_errors:errors.slice(-8)});
});

app.listen(PORT,()=>console.log(`UDC One-Click V48 ULTRA listening on ${PORT}`));
