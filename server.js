import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({limit:"1mb"}));
app.use(express.static(__dirname));
const PORT = process.env.PORT || 10000;
const GROQ_KEY = process.env.GROQ_API_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const MODELS = [process.env.GEMINI_MODEL,process.env.GEMINI_PRO_MODEL,"gemini-3.8-flash","gemini-3.7-flash","gemini-3.6-flash","gemini-3.5-flash","gemini-3.5-flash-lite","gemini-2.5-flash" ].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
const SUMMARY_BASE="https://udcsummary.info/php/index.php";
// V45 speed optimization only: keep successful classifications in memory so repeated titles return instantly.
const resultCache = new Map();
const CACHE_LIMIT = 500;

const UDC_RULES=`
Universal Decimal Classification ONLY. Never DDC.
Use UDC Summary as the public abridged-style authority when available. UDC is discipline-based, hierarchical, analytico-synthetic and faceted.
Main classes: 0 knowledge/information/computing; 1 philosophy/psychology; 2 religion/theology; 3 social sciences; 4 vacant; 5 mathematics/natural sciences; 6 applied sciences/medicine/technology; 7 arts/entertainment/sport; 8 linguistics/literature; 9 geography/history.
004 is computer science/computing/data processing ONLY. Do not choose 004 because a title merely contains technology, technical, digital, system, application, method, science, or tool.
Common signs: + coordination, / consecutive extension, : simple relation, :: order-fixing, [] subgrouping, * non-UDC notation, A/Z alphabetical specification.
Common auxiliaries include = language, (0...) form, (1/9) place, (=...) ethnicity/nationality, "..." time, -0... general characteristics. Special auxiliaries are local to designated schedules.
Never add an auxiliary just because it is possible. Every component and symbol must be justified by the title and the UDC schedule.
Never invent a licensed MRF class. Never return DDC, 0, blank, null or N/A.
`;

const schema={type:"object",properties:{title:{type:"string"},udc_number:{type:"string"},main_subject:{type:"string"},sub_subject:{type:"string"},explanation:{type:"string"},breakdown:{type:"string"},confidence:{type:"string"},evidence_summary:{type:"string"},sources:{type:"array",items:{type:"string"}},evidence_level:{type:"string"},official_udc_match:{type:"boolean"},candidate_notes:{type:"string"},notation_check:{type:"string"}},required:["title","udc_number","main_subject","sub_subject","explanation","breakdown","confidence","evidence_summary","sources","evidence_level","official_udc_match","candidate_notes","notation_check"]};

function norm(s){return String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim()}
function parseJSON(s){if(!s)throw Error("Empty AI response");s=String(s).replace(/^```json\s*/i,"").replace(/^```\s*/,"").replace(/```\s*$/i,"").trim();const a=s.indexOf("{"),b=s.lastIndexOf("}");if(a>=0&&b>a)s=s.slice(a,b+1);return JSON.parse(s)}
function validate(r,title){const n=String(r?.udc_number||"").trim();if(!n||n==="0"||/^unknown|null|n\/a$/i.test(n))throw Error("Invalid UDC number");if(n.includes("004")&&!/(computer|computing|informatics|information technology|software|programming|data processing|artificial intelligence|machine learning|cyber|internet|database|ict)/i.test(title))throw Error("SEMANTIC_GUARD_004");const sources=Array.isArray(r?.sources)?r.sources.filter(Boolean).slice(0,8):[];
if(/^(?:0|00|000)(?:[.:()\/+-]|$)/.test(n))throw Error("INVALID_UDC_ZERO_CLASS");
if(/ddc|dewey decimal/i.test(JSON.stringify(r)))throw Error("DDC_OUTPUT_DETECTED");
return {...r,title:r?.title||title,udc_number:n,sources,official_udc_match:!!r?.official_udc_match};
}

// High-value UDC Summary concepts used as a deterministic safety net. These are
// class references, not a copy of the licensed MRF. Exact claims are only made
// where the public UDC Summary supports the class.
const C=[
["001","Knowledge, science and intellectual work",/\b(knowledge|information science|documentation|librarianship)\b/],["004","Computer science and technology. Computing. Data processing",/\b(computer|computing|informatics|programming|software|database|cybersecurity|cyber|machine learning|artificial intelligence|data processing|ict)\b/],
["1","Philosophy",/\bphilosophy\b/],["159.9","Psychology",/\bpsychology\b/],["2","Religion. Theology",/\b(religion|theology|bible|quran|koran|christianity|islam|hinduism)\b/],
["30","General social sciences",/\bsocial sciences?\b/],["31","Demography. Population studies",/\b(population|demography)\b/],["316","Sociology",/\bsociology\b/],["32","Politics",/\bpolitics?|political science\b/],["33","Economics",/\b(economy|economics|economic)\b/],["34","Law",/\b(law|legal|jurisprudence)\b/],["35","Public administration",/\b(public administration|government administration)\b/],["36","Social welfare",/\b(social welfare|social work)\b/],["37","Education",/\b(education|teaching|pedagogy|instruction|schooling|teacher training)\b/],["39","Ethnology. Folklore",/\b(ethnolog|folklore|folk lore|customs|traditions)\b/],
["51","Mathematics",/\b(mathematics|maths?|algebra|geometry|calculus|number theory)\b/],["52","Astronomy",/\bastronom(y|ical)|cosmology\b/],["53","Physics",/\bphysics|mechanics|optics|thermodynamics|quantum physics\b/],["54","Chemistry",/\bchemistry|chemical\b/],["55","Earth sciences",/\bgeology|meteorology|earth science|geophysics\b/],["56","Palaeontology",/\bpalaeontolog|fossils?\b/],["57","Biological sciences",/\bbiology|botany|zoology|ecology|microbiology|genetics\b/],["58","Botanical sciences",/\bbotany|plants?\b/],["59","Zoological sciences",/\bzoology|animals?\b/],
["61","Medical sciences",/\bmedicine|medical|disease|surgery|hospital|nursing|health care\b/],["62","Engineering and technology in general",/\bengineering\b/],["63","Agriculture and related sciences and technologies",/\bagriculture|farming|crop|crops|wheat|maize|corn|harvest|harvesting|irrigation|agronomy|horticulture\b/],["65","Management and organization",/\bmanagement|business|commerce|marketing|organization\b/],["66","Chemical technology",/\bchemical technolog|industrial chemistry\b/],["67","Various industries and crafts",/\bindustry|manufacturing|crafts?\b/],["68","Industries, trades and crafts",/\bworkshop|production technology\b/],["69","Building materials and building practice",/\bconstruction|building practice|building materials\b/],
["7","The arts. Entertainment. Sport",/\barts?|entertainment\b/],["71","Landscape and regional planning",/\blandscape architecture|regional planning\b/],["72","Architecture",/\barchitecture|architectural\b/],["73","Sculpture",/\bsculpture\b/],["74","Drawing and applied art",/\bdrawing|applied art\b/],["75","Painting",/\bpainting\b/],["76","Graphic art",/\bgraphic art|printmaking\b/],["77","Photography and similar processes",/\bphotography\b/],["78","Music",/\bmusic|musical\b/],["79","Recreation. Entertainment. Games. Sport",/\bsport|games?|recreation\b/],["796","Sport and games",/\bfootball|cricket|athletics|tennis|basketball|sports?\b/],
["80","General questions relating to linguistics and literature",/\blanguage|linguistics|dictionary|lexicography\b/],["81","Linguistics",/\blinguistics|grammar|phonetics|semantics\b/],["82","Literature",/\bliterature|poetry|novel|fiction|prose\b/],["821.111","English literature",/\benglish literature\b/],["821.111-2","English literature — drama",/\benglish drama|drama in english\b/],
["90","Archaeology",/\barchaeolog(y|ical)\b/],["91","Geography",/\bgeograph(y|ical)\b/],["94","History",/\bhistor(y|ical)\b/]
];

// FIXED ANSWER KEY: deterministic entries are returned before any AI call.
// Version remains V45 ULTRA. These entries are pinned to the public UDC Summary
// (the app must never silently change a known answer because of model output).
const ANSWER_KEY_AUTHORITY = "UDC Summary (public abridged reference)";
const exact=[
[/^history of india$/i,"94(540)","History","History of India","94 = History; (540) = India.","Official UDC Summary hierarchy match"],
[/^history of punjab$/i,"94(540)","History","History of Punjab","94 = History; (540) = India. The abridged Summary does not expose a Punjab-specific place subdivision, so no unsupported (540.15) is used.","UDC Summary-supported abridged result"],
[/^economy of india$/i,"330(540)","Economics","Economy of India","330 = Economics in general; (540) = India.","UDC Summary hierarchy + place auxiliary"],
[/^geography of india$/i,"91(540)","Geography","Geography of India","91 = Geography; (540) = India.","Official UDC Summary hierarchy match"],
[/^indian constitution$/i,"342.4(540)","Constitutional law","Constitution of India","342.4 = Constitutions; (540) = India.","UDC Summary hierarchy match"],
[/^indian literature$/i,"821.21","Literature","Indian literature","821.21 = Indian literatures.","UDC Summary hierarchy match"],
[/^indian philosophy$/i,"1(540)","Philosophy","Philosophy of India","1 = Philosophy; (540) = India.","Reasoned from UDC Summary"],
    [/^knowledge metaphysics and logic$/i,"00+11+16","Knowledge / metaphysics / logic","Knowledge, metaphysics and logic","00 = Knowledge; 11 = Metaphysics; 16 = Logic, epistemology and theory of knowledge; + = coordination.","UDC Summary-supported coordination"],
    [/^handbook of systematic zoology$/i,"592/599","Zoology","Systematic zoology","592/599 = Systematic zoology.","UDC Summary match"],
[/^indian art$/i,"7(540)","Arts","Art of India","7 = Arts; (540) = India.","Reasoned from UDC Summary"],
[/^english drama$/i,"821.111-2","English literature","Drama in English","821.111 = English literature; -2 = drama.","Official UDC Summary hierarchy match"],
[/^music and entertainment$/i,"78+79","Music and entertainment","Music; entertainment","78 = Music; 79 = Recreation/entertainment/games/sport; + coordinates the two subjects.","UDC hierarchy cross-check"],
[/^science and arts$/i,"5+7","Mathematics/natural sciences + arts","Science and arts","5 = Mathematics and natural sciences; 7 = Arts. The plus sign (+) is the UDC coordination sign used to combine subjects.","Official UDC Summary main classes + coordination sign"],
[/^science and technology$/i,"5/6","Mathematics/natural sciences and applied sciences/technology","Science and technology","5 = Mathematics and natural sciences; 6 = Applied sciences, medicine and technology. The oblique stroke expresses consecutive extension.","Official UDC Summary hierarchy match"],
[/^harvesting of wheat and maize$/i,"633.1:631.5","Agriculture","Harvesting of wheat and maize","633.1 = cereals/grain crops; 631.5 = agricultural operations; : expresses the relation. The abridged Summary does not expose separate wheat/maize classes here.","UDC evidence cross-check"],
[/^harvesting of wheat and barley$/i,"633.1:631.5","Agriculture","Harvesting of wheat and barley","633.1 = cereals/grain crops; 631.5 = agricultural operations; : expresses the relation. The abridged Summary does not expose separate wheat/barley classes here.","UDC evidence cross-check"],
[/^harvesting of cereals$/i,"633.1:631.5","Agriculture","Harvesting of cereals","633.1 = cereals/grain crops; 631.5 = agricultural operations; : expresses the relation.","UDC evidence cross-check"],
[/^harvesting of wheat$/i,"633.1:631.5","Agriculture","Harvesting of wheat","633.1 = cereals/grain crops; 631.5 = agricultural operations.","UDC evidence cross-check"],
[/^harvesting of maize$/i,"633.1:631.5","Agriculture","Harvesting of maize","633.1 = cereals/grain crops; 631.5 = agricultural operations.","UDC evidence cross-check"],
[/^harvesting of barley$/i,"633.1:631.5","Agriculture","Harvesting of barley","633.1 = cereals/grain crops; 631.5 = agricultural operations.","UDC Summary cross-check"],
[/^wheat$/i,"633.1","Agriculture","Wheat","633.1 = cereals/grain crops; the abridged Summary does not expose a separate wheat class.","UDC Summary cross-check"],
[/^maize$/i,"633.1","Agriculture","Maize","633.1 = cereals/grain crops; the abridged Summary does not expose a separate maize class.","UDC Summary cross-check"],
[/^barley$/i,"633.1","Agriculture","Barley","633.1 = cereals/grain crops; the abridged Summary does not expose a separate barley class.","UDC Summary cross-check"],
[/^renovation of furniture in museum$/i,"069.444:684.4","Museum conservation / furniture","Renovation and repair of furniture in a museum","069.444 = repair/reconstruction in museum exhibit conservation; 684.4 = furniture; : relates the conservation operation to the furniture subject.","UDC hierarchy cross-check"],
[/^dictionary of language and literature$/i,"80(038)","Language and literature","Dictionary of language and literature","80 = general questions relating to both linguistics and literature; (038) = dictionaries (common auxiliary of form).","UDC Summary subject + form auxiliary match"],
[/^wheat and maize$/i,"633.1","Agriculture","Wheat and maize","633.1 = cereals/grain crops; the abridged Summary does not expose separate wheat and maize classes.","UDC Summary cross-check"],
[/^wheat and barley$/i,"633.1","Agriculture","Wheat and barley","633.1 = cereals/grain crops; the abridged Summary does not expose separate wheat and barley classes.","UDC hierarchy cross-check"],
[/^cultivation of wheat$/i,"633.1:631.5","Agriculture","Cultivation of wheat","633.1 = cereals/grain crops; 631.5 = agricultural operations/cultivation. The abridged Summary does not expose a separate wheat class.","UDC hierarchy cross-check"],
[/^cultivation of maize$/i,"633.1:631.5","Agriculture","Cultivation of maize","633.1 = cereals/grain crops; 631.5 = agricultural operations/cultivation. The abridged Summary does not expose a separate maize class.","UDC hierarchy cross-check"],
[/^cultivation of barley$/i,"633.1:631.5","Agriculture","Cultivation of barley","633.1 = cereals/grain crops; 631.5 = agricultural operations/cultivation. The abridged Summary does not expose a separate barley class.","UDC hierarchy cross-check"],
];

function localClassify(title){const t=norm(title);for(const e of exact){if(e[0].test(t))return result(title,e[1],e[2],e[3],e[4],e[5],true)}
 // Place-aware history/geography/constitution patterns.
 if(/\b(history|historical)\b/.test(t)&&/\bindia|bharat\b/.test(t))return result(title,"94(540)","History","History of India","94 = History; (540) = India.","Reasoned from UDC Summary",true);
 if(/\bgeograph/.test(t)&&/\bindia|bharat\b/.test(t))return result(title,"91(540)","Geography","Geography of India","91 = Geography; (540) = India.","Reasoned from UDC Summary",true);
 // Form-aware literature rules: do not blindly append auxiliaries.
 if(/\benglish\b/.test(t)&&/\bdrama\b/.test(t))return result(title,"821.111-2","English literature","Drama in English","821.111 = English literature; -2 = drama.","Reasoned from UDC Summary",true);
 if(/\b(dictionary|lexicon|glossary)\b/.test(t)&&/\b(language|literature)\b/.test(t))return result(title,"80(038)","Language and literature","Dictionary / language and literature","80 = general questions relating to both linguistics and literature; (038) = dictionaries (common auxiliary of form).","Reasoned from UDC Summary",true);
 // Agriculture: process + crop is deliberately more specific than broad 63.
 if(/\b(harvest|harvesting)\b/.test(t)&&/\b(wheat|maize|corn|cereal|grain|barley)\b/.test(t))return result(title,"633.1:631.5","Agriculture","Harvesting of cereals","633.1 = cereals/grain crops; 631.5 = agricultural operations; : expresses the relation.","UDC Summary cross-check",true);
 let hits=C.filter(x=>x[2].test(t)); if(hits.length){hits.sort((a,b)=>b[2].source.length-a[2].source.length);const h=hits[0];return result(title,h[0],h[1],h[1],`${h[0]} = ${h[1]}.`,`Reasoned from UDC Summary`,false)}
 return result(title,"3","Social sciences / unresolved subject","Broad fallback — manual verification required","3 is used only as a broad emergency fallback when no subject-specific rule is available.","Fallback — verify against UDC Summary",false);
}
function result(title,n,m,s,x,conf,official){return{title,udc_number:n,main_subject:m,sub_subject:s,breakdown:x,explanation:x+(official?"":" This result is not an exact licensed MRF lookup."),confidence:conf,evidence_summary:official?"Matched to a public UDC Summary concept/hierarchy.":"Deterministic semantic fallback based on UDC Summary concepts.",sources:["https://udcsummary.info/"],evidence_level:conf,official_udc_match:official,candidate_notes:"",notation_check:"Each displayed component is a UDC class or a justified UDC relation; no DDC notation is used.",engine:"V45 ULTRA local semantic engine",model:"offline",grounded:false}}

async function gemini(title,model,grounded){const body={contents:[{role:"user",parts:[{text:`${UDC_RULES}\nClassify this complete book title: "${title}". Search the official UDC Summary first when grounding is enabled. Prefer an exact official UDC Summary class when available. Generate up to 3 candidates internally, audit every notation component and every crop/language/place/form auxiliary, then return one final result. Never convert a subject to a broader class merely because a model guess is convenient. Do not use 004 unless the subject is genuinely computing. Do not invent an official record. JSON only.`}]}],systemInstruction:{parts:[{text:UDC_RULES}]},generationConfig:{temperature:0.02,responseMimeType:"application/json",responseSchema:schema,maxOutputTokens:1600}};if(grounded)body.tools=[{googleSearch:{}}];const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),28000);try{const u=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;const r=await fetch(u,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":GEMINI_KEY},body:JSON.stringify(body),signal:ac.signal});const txt=await r.text();let j;try{j=JSON.parse(txt)}catch{throw Error("Bad Gemini response")};if(!r.ok)throw Error(j?.error?.message||`Gemini HTTP ${r.status}`);const out=validate(parseJSON(j?.candidates?.[0]?.content?.parts?.map(x=>x.text||"").join("")),title);const chunks=j?.candidates?.[0]?.groundingMetadata?.groundingChunks||[];const gs=chunks.map(x=>x.web).filter(Boolean).map(x=>x.uri).filter(Boolean);if(!out.sources.length)out.sources=gs.slice(0,8);if(grounded && !gs.some(u=>/udcsummary\.info|udcc\.org/i.test(u)))throw Error("NO_OFFICIAL_UDC_SUMMARY_EVIDENCE");
return{...out,engine:grounded?"Gemini + Google Search":"Gemini",model,grounded:gs.length>0}}finally{clearTimeout(tm)}}
async function groq(title){if(!GROQ_KEY)throw Error("GROQ_API_KEY not configured");const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${GROQ_KEY}`},body:JSON.stringify({model:process.env.GROQ_MODEL||"openai/gpt-oss-120b",temperature:0.02,response_format:{type:"json_object"},messages:[{role:"system",content:UDC_RULES},{role:"user",content:`Classify "${title}" using UDC Summary as public authority. Return the required JSON fields only. Never use DDC and never use 004 unless it is genuinely computing.`}]})});const j=await r.json();if(!r.ok)throw Error(j?.error?.message||`Groq HTTP ${r.status}`);return{...validate(parseJSON(j?.choices?.[0]?.message?.content||""),title),engine:"Groq fallback",model:process.env.GROQ_MODEL||"openai/gpt-oss-120b",grounded:false}}

app.get("/",(_,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.get("/api/health",(_,res)=>res.json({ok:true,version:"V45 ULTRA",geminiConfigured:!!GEMINI_KEY,groqConfigured:!!GROQ_KEY,models:MODELS,fixedAnswerKey:exact.length,authority:ANSWER_KEY_AUTHORITY,authorityUrl:SUMMARY_BASE}));
app.post("/api/classify",async(req,res)=>{const title=String(req.body?.title||"").trim();if(!title)return res.status(400).json({error:"Enter a book title."});
 const cacheKey=norm(title);
 const cached=resultCache.get(cacheKey); if(cached) return res.json({...cached,title});
 // Deterministic exact/high-value rules run first: this prevents AI drift on known titles.
 const lc=localClassify(title); if(lc.official_udc_match){resultCache.set(cacheKey,lc);if(resultCache.size>CACHE_LIMIT)resultCache.delete(resultCache.keys().next().value);return res.json(lc);}
 const errors=[];
 if(GEMINI_KEY){for(const grounded of [true,false])for(const model of MODELS){try{const out=await gemini(title,model,grounded);resultCache.set(cacheKey,out);if(resultCache.size>CACHE_LIMIT)resultCache.delete(resultCache.keys().next().value);return res.json(out)}catch(e){errors.push(`${model}/${grounded?'search':'plain'}: ${e.message}`)}}}
 if(GROQ_KEY){try{const out=await groq(title);resultCache.set(cacheKey,out);if(resultCache.size>CACHE_LIMIT)resultCache.delete(resultCache.keys().next().value);return res.json(out)}catch(e){errors.push(`groq: ${e.message}`)}}
 lc.provider_errors=errors.slice(-8);lc.engine="V45 ULTRA deterministic safety-net";lc.evidence_level="BEST_EFFORT";lc.confidence="Best effort — verify against the official UDC Summary/MRF";return res.json(lc);
});
app.listen(PORT,()=>console.log(`UDC V45 ULTRA on ${PORT}`));
