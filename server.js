const express=require("express");
const path=require("path");
const app=express();
app.use(express.json({limit:"64kb"}));
app.use(express.static(path.join(__dirname)));
const PORT=process.env.PORT||10000;

const MODELS={
 geminiFast:process.env.GEMINI_FAST_MODEL||"gemini-3.8-flash",
 geminiPro:process.env.GEMINI_PRO_MODEL||"gemini-3.1-pro-preview",
 groqCompound:process.env.GROQ_COMPOUND_MODEL||"groq/compound",
 groq120:process.env.GROQ_MODEL_120B||"openai/gpt-oss-120b",
 groqQwen:process.env.GROQ_MODEL_QWEN||"qwen/qwen3.8-27b",
 openai:process.env.OPENAI_MODEL||"gpt-5.6-sol",
 anthropic:process.env.ANTHROPIC_MODEL||"claude-opus-5"
};

const UDC_SYSTEM=`You are UDC TITAN, an evidence-aware Universal Decimal Classification research engine.

NON-NEGOTIABLE: UDC ONLY. Never answer with DDC, LCC, Colon Classification, NLM, or another classification scheme.

Goal: classify a book TITLE, not merely keywords. First infer the actual intellectual subject and facets. Then generate several plausible UDC candidates. Then verify notation and hierarchy against available authoritative evidence. Never manufacture a classmark.

Use UDC analytic-synthetic principles. Consider, only when justified:
- main classes 0–9 and their hierarchy
- coordination +, consecutive extension /, relation :, order fixing ::, subgrouping [ ]
- common auxiliaries such as language =..., form (0...), place (1/9), nationality/ethnicity (=...), time "...", and general characteristics -0...
- special auxiliaries within their designated classes
- non-UDC notation markers * and A/Z only when the schedule requires them
- literature: language vs literature vs literary form/study
- dictionaries/encyclopedias/handbooks/manuals: subject vs form
- history/geography: place and time
- science/technology: actual process, material, object and application
- medicine: actual disease/body system/process/diagnosis/therapy rather than a generic parent.

Evidence rules:
1. Prefer UDC Consortium material and licensed/authorized UDC schedules when available.
2. Library catalogue records are corroboration, not automatically authoritative.
3. A search result explaining UDC notation is not proof of a specific classmark.
4. Never invent URLs or claim a source supports a number unless the evidence actually does.
5. If evidence is insufficient, return REQUIRES VERIFICATION rather than a confident guess.
6. Do not convert DDC into UDC.
7. Explicit title facets must be respected.

Return JSON only:
{"udc":"","title":"","subject":"","sub_subject":"","context":"","breakdown":[],"explanation":"","confidence":"High|Medium|Low|Requires verification","evidence_level":"","status":"","candidates":[{"udc":"","reason":"","verdict":"SUPPORTED|REJECTED|UNCERTAIN"}],"sources":[],"warnings":[]}
No markdown fences.`;

function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function cleanText(x){return String(x||"").replace(/^```json\s*/i,"").replace(/```\s*$/,"").trim()}
function parseJSON(x){try{return JSON.parse(cleanText(x))}catch(e){let m=cleanText(x).match(/\{[\s\S]*\}/);if(!m)throw e;return JSON.parse(m[0])}}
function normalize(o,title){return {
 udc:String(o?.udc||"REQUIRES VERIFICATION").trim(),title,
 subject:String(o?.subject||"").trim(),sub_subject:String(o?.sub_subject||"").trim(),context:String(o?.context||"").trim(),
 breakdown:Array.isArray(o?.breakdown)?o.breakdown.map(String):[],explanation:String(o?.explanation||"").trim(),
 confidence:String(o?.confidence||"Requires verification"),evidence_level:String(o?.evidence_level||"Not established"),
 status:String(o?.status||"Requires verification"),candidates:Array.isArray(o?.candidates)?o.candidates.slice(0,10):[],
 sources:Array.isArray(o?.sources)?o.sources:[],warnings:Array.isArray(o?.warnings)?o.warnings.map(String):[]
}}
function audit(title,o){
 const t=title.toLowerCase(), n=o.udc.replace(/\s+/g,""); let w=[];
 if(/\bheart disease\b|\bcardiovascular disease\b|\bcoronary disease\b|\bmyocardial\b|\bcardiac disease\b/.test(t)&&/^61(?:[.(]|$)/.test(n)){w.push("Broad 61 medicine parent rejected for a disease-specific heart/cardiovascular title; verify the 616 hierarchy.");o.udc="REQUIRES VERIFICATION";o.confidence="Requires verification";o.status="Consistency gate rejected candidate"}
 if(/\bhistory of india\b/.test(t)&&/^94$/.test(n)){w.push("India facet requires place-auxiliary verification.");o.udc="REQUIRES VERIFICATION";o.confidence="Requires verification"}
 if(/\bgeography of india\b/.test(t)&&/^91$/.test(n)){w.push("India facet requires place-auxiliary verification.");o.udc="REQUIRES VERIFICATION";o.confidence="Requires verification"}
 if(/\bddc\b/i.test(JSON.stringify(o))){w.push("Cross-scheme contamination detected.");}
 o.warnings=[...new Set([...(o.warnings||[]),...w])]; return o;
}

async function gemini(model,title){
 if(!process.env.GEMINI_API_KEY)throw new Error("Gemini key not configured");
 const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
 const body={systemInstruction:{parts:[{text:UDC_SYSTEM}]},contents:[{role:"user",parts:[{text:`Classify this book title: "${title}". Search for current UDC evidence where useful. Return JSON only.`}]}],generationConfig:{temperature:0.1}};
 // Google Search grounding is enabled for current Gemini models.
 body.tools=[{google_search:{}}];
 let last;
 for(let i=0;i<3;i++){try{
  let r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  let txt=await r.text();if(!r.ok){last=new Error(`Gemini ${r.status}`);if([429,500,502,503,504].includes(r.status)){await sleep(700*(i+1));continue}throw last}
  let j=JSON.parse(txt), out=(j.candidates?.[0]?.content?.parts||[]).map(x=>x.text||"").join("");
  let o=normalize(parseJSON(out),title);
  let chunks=j.candidates?.[0]?.groundingMetadata?.groundingChunks||[];
  let sources=chunks.map(x=>x.web).filter(Boolean).map(w=>({title:w.title||"Google result",url:w.uri||""})).filter(x=>x.url);
  if(sources.length)o.sources=sources.slice(0,15);
  return audit(title,o);
 }catch(e){last=e;if(i<2)await sleep(600*(i+1))}}
 throw last||new Error("Gemini failed");
}

async function groq(model,title){
 if(!process.env.GROQ_API_KEY)throw new Error("Groq key not configured");
 const body={model,messages:[{role:"system",content:UDC_SYSTEM},{role:"user",content:`Classify: "${title}". Return JSON only. Do not invent a UDC number.`}],temperature:0.1,response_format:{type:"json_object"}};
 let last;
 for(let i=0;i<3;i++){try{
  let r=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.GROQ_API_KEY}`},body:JSON.stringify(body)});
  let txt=await r.text();if(!r.ok){last=new Error(`Groq ${r.status}`);if([429,500,502,503,504].includes(r.status)){await sleep(500*(i+1));continue}throw last}
  let j=JSON.parse(txt), o=normalize(parseJSON(j.choices?.[0]?.message?.content||""),title);return audit(title,o);
 }catch(e){last=e;if(i<2)await sleep(500*(i+1))}}
 throw last;
}

async function openai(title){
 if(!process.env.OPENAI_API_KEY)throw new Error("OpenAI key not configured");
 let r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:MODELS.openai,input:[{role:"system",content:UDC_SYSTEM},{role:"user",content:`Classify: "${title}". Return JSON only.`}],tools:[{type:"web_search_preview"}]})});
 let txt=await r.text();if(!r.ok)throw new Error(`OpenAI ${r.status}`);let j=JSON.parse(txt);
 let out=j.output_text||"";return audit(title,normalize(parseJSON(out),title));
}
async function anthropic(title){
 if(!process.env.ANTHROPIC_API_KEY)throw new Error("Anthropic key not configured");
 let r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:MODELS.anthropic,max_tokens:5000,system:UDC_SYSTEM,messages:[{role:"user",content:`Classify: "${title}". Return JSON only.`}]})});
 let txt=await r.text();if(!r.ok)throw new Error(`Anthropic ${r.status}`);let j=JSON.parse(txt),out=(j.content||[]).map(x=>x.text||"").join("");return audit(title,normalize(parseJSON(out),title));
}

/*
 Adaptive jury:
 - First Google-grounded Gemini 3.8 Flash.
 - Then Gemini 3.1 Pro if available.
 - Then Groq Compound / GPT-OSS / Qwen.
 - Optional OpenAI / Anthropic.
 - A disagreement is not hidden: the final answer becomes REQUIRES VERIFICATION
   unless a configured adjudication route resolves it.
 This prevents a quota/error from turning into a fake UDC number.
*/
async function jury(title){
 const jobs=[
  ["Gemini 3.8 Flash","gemini",()=>gemini(MODELS.geminiFast,title)],
  ["Gemini 3.1 Pro","gemini",()=>gemini(MODELS.geminiPro,title)],
  ["Groq Compound","groq",()=>groq(MODELS.groqCompound,title)],
  ["Groq GPT-OSS 120B","groq",()=>groq(MODELS.groq120,title)],
  ["Groq Qwen 3.8","groq",()=>groq(MODELS.groqQwen,title)],
  ["OpenAI","openai",()=>openai(title)],
  ["Anthropic","anthropic",()=>anthropic(title)]
 ];
 const results=[], providers=[];
 for(const [name,kind,fn] of jobs){
  try{let o=await fn();results.push(o);providers.push({provider:name,model:kind,result:"OK"});if(results.length>=3)break}
  catch(e){providers.push({provider:name,model:kind,result:"SKIPPED"})}
 }
 if(!results.length)throw new Error("No configured AI provider returned a usable response.");

 // Consensus by normalized classmark. Require corroboration when possible.
 const groups=new Map();
 for(const o of results){const k=o.udc.replace(/\s+/g,"").toUpperCase();if(k!=="REQUIRESVERIFICATION")groups.set(k,(groups.get(k)||[]).concat([o]))}
 let winner=null;
 for(const [k,arr] of groups){if(!winner||arr.length>winner.length)winner=arr}
 if(winner&&winner.length>=2){
  let base=winner[0];base.providers=providers;base.warnings=[...new Set([...(base.warnings||[]),"Final classmark corroborated by multiple configured AI routes."])];
  base.candidates=results.flatMap(x=>x.candidates||[]).slice(0,12);return base;
 }
 // If only one usable route answered, do not pretend it was a consensus.
 let base=results[0];base.providers=providers;base.warnings=[...new Set([...(base.warnings||[]),"Only one usable AI route returned a classmark; independent corroboration was unavailable."])];
 if(results.length>1){base.udc="REQUIRES VERIFICATION";base.confidence="Requires verification";base.status="AI jury disagreement";base.explanation=(base.explanation||"")+" Other configured AI routes did not independently corroborate the same classmark."}
 return base;
}

app.post("/api/classify",async(req,res)=>{
 const title=String(req.body?.title||"").trim();
 if(!title)return res.status(400).json({error:"Book title is required."});
 try{res.json(await jury(title))}
 catch(e){console.error("TITAN_ERROR",e);res.status(503).json({error:"No AI route is currently available. Check API keys, quota and provider status. No UDC number was invented."})}
});

const PRACTICE=[
["History of India","94(540)","94 — History; (540) — India"],
["Geography of India","91(540)","91 — Geography; (540) — India"],
["Indian Constitution","342(540)","342 — Constitutional law; (540) — India"],
["Economy of India","330(540)","330 — Economics; (540) — India"],
["History of Punjab","94(540.15)","94 — History; (540.15) — Punjab"]
];
app.get("/api/practice",(req,res)=>{let x=PRACTICE[Math.floor(Math.random()*PRACTICE.length)];res.json({title:x[0],udc:x[1],explanation:x[2]})});
app.get("/api/health",(req,res)=>res.json({
 version:"UDC-TITAN-50",geminiFast:MODELS.geminiFast,geminiPro:MODELS.geminiPro,
 groqCompound:MODELS.groqCompound,groq120:MODELS.groq120,groqQwen:MODELS.groqQwen,
 openai:MODELS.openai,anthropic:MODELS.anthropic,
 configured:{gemini:Boolean(process.env.GEMINI_API_KEY),groq:Boolean(process.env.GROQ_API_KEY),openai:Boolean(process.env.OPENAI_API_KEY),anthropic:Boolean(process.env.ANTHROPIC_API_KEY)},
 googleSearchGrounding:true,seedReference:false,serverTime:new Date().toISOString()
}));
app.listen(PORT,()=>console.log(`UDC TITAN v50 on ${PORT}`));
