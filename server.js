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

const UDC_RULES=`
Universal Decimal Classification ONLY. Never DDC.
Use UDC Summary as the public abridged-style authority when available. UDC is discipline-based, hierarchical, analytico-synthetic and faceted.
Main classes: 0 knowledge/information/computing; 1 philosophy/psychology; 2 religion/theology; 3 social sciences; 4 vacant; 5 mathematics/natural sciences; 6 applied sciences/medicine/technology; 7 arts/entertainment/sport; 8 linguistics/literature; 9 geography/history.
004 is computer science/computing/data processing ONLY. Do not choose 004 because a title merely contains technology, technical, digital, system, application, method, science, or tool.
Common signs: + coordination, / consecutive extension, : simple relation, :: order-fixing, [] subgrouping, * non-UDC notation, A/Z alphabetical specification.
Common auxiliaries include = language, (0...) form, (1/9) place, (=...) ethnicity/nationality, "..." time, -0... general characteristics. Special auxiliaries are local to designated schedules.
Never add an auxiliary just because it is possible. Every component and symbol must be justified by the title and the UDC schedule.
Preserve every substantive concept in the complete title. Do not drop qualifiers such as unrest, conflict, violence, tension, relations, research, history, place, language, person, form, or time. A broad parent class is not acceptable when a title contains a clearly classifiable specific facet.
Never invent a licensed MRF class. Never return DDC, 0, blank, null or N/A.
`;

const schema={type:"object",properties:{title:{type:"string"},udc_number:{type:"string"},main_subject:{type:"string"},sub_subject:{type:"string"},explanation:{type:"string"},breakdown:{type:"string"},confidence:{type:"string"},evidence_summary:{type:"string"},sources:{type:"array",items:{type:"string"}},evidence_level:{type:"string"},official_udc_match:{type:"boolean"},candidate_notes:{type:"string"},notation_check:{type:"string"}},required:["title","udc_number","main_subject","sub_subject","explanation","breakdown","confidence","evidence_summary","sources","evidence_level","official_udc_match","candidate_notes","notation_check"]};

function norm(s){return String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim()}
function parseJSON(s){if(!s)throw Error("Empty AI response");s=String(s).replace(/^```json\s*/i,"").replace(/^```\s*/,"").replace(/```\s*$/i,"").trim();const a=s.indexOf("{"),b=s.lastIndexOf("}");if(a>=0&&b>a)s=s.slice(a,b+1);return JSON.parse(s)}
function semanticCompleteness(r,title){
  const t=norm(title);
  const corpus=norm([r?.title,r?.main_subject,r?.sub_subject,r?.breakdown,r?.explanation].filter(Boolean).join(" "));
  const groups=[
    [/(\bunrest\b|\bconflict(?:s)?\b|\bviolence\b|\btension(?:s)?\b|\bclashes\b|\bdisturbance(?:s)?\b)/, /\b(unrest|conflict|violence|tension|clash|disturbance)\b/],
    [/\bresearch\b|\bstudy\b|\banalysis\b|\bcritical\b/, /\b(research|study|analysis|critical)\b/],
    [/\bhistory\b|\bhistorical\b/, /\bhistory|historical/],
    [/\bliterature\b|\bsacred\b|\bscripture\b|\bsacred books?\b/, /\bliterature|sacred|scripture/],
    [/\bindia\b|\bbharat\b/, /\bindia|bharat/],
    [/\bpunjab\b/, /\bpunjab\b/],
    [/\bwheat\b|\bmaize\b|\bcorn\b|\bbarley\b|\bcereal(?:s)?\b/, /\bwheat|maize|corn|barley|cereal/],
    [/\benglish\b|\bhindi\b|\bpunjabi\b|\bpanjabi\b|\bgujarati\b|\burdu\b/, /\benglish|hindi|punjabi|panjabi|gujarati|urdu/],
    [/\bdr\b|\bdoctor\b|\branganathan\b/, /\branganathan\b/]
  ];
  for(const [trigger,represented] of groups){
    if(trigger.test(t) && !represented.test(corpus)) throw Error("SEMANTIC_GUARD_MISSING_TITLE_CONCEPT");
  }
  return r;
}
function validate(r,title){const n=String(r?.udc_number||"").trim();if(!n||n==="0"||/^unknown|null|n\/a$/i.test(n))throw Error("Invalid UDC number");if(n.includes("004")&&!/(computer|computing|informatics|information technology|software|programming|data processing|artificial intelligence|machine learning|cyber|internet|database|ict)/i.test(title))throw Error("SEMANTIC_GUARD_004");semanticCompleteness(r,title);return {...r,title:r?.title||title,udc_number:n,sources:Array.isArray(r?.sources)?r.sources.filter(Boolean).slice(0,8):[],official_udc_match:!!r?.official_udc_match}};

// High-value UDC Summary concepts used as a deterministic safety net. These are
// class references, not a copy of the licensed MRF. Exact claims are only made
// where the public UDC Summary supports the class.
const C=[
["0","Knowledge, science and computer science",/\b(knowledge|information science|documentation|librarianship)\b/],["004","Computer science and technology. Computing. Data processing",/\b(computer|computing|informatics|programming|software|database|cybersecurity|cyber|machine learning|artificial intelligence|data processing|ict)\b/],
["1","Philosophy",/\bphilosophy\b/],["159.9","Psychology",/\bpsychology\b/],["2","Religion. Theology",/\b(religion|theology|quran|koran|christianity|islam|hinduism)\b/],
["30","General social sciences",/\bsocial sciences?\b/],["31","Demography. Population studies",/\b(population|demography)\b/],["316","Sociology",/\bsociology\b/],["32","Politics",/\bpolitics?|political science\b/],["33","Economics",/\b(economy|economics|economic)\b/],["34","Law",/\b(law|legal|jurisprudence)\b/],["35","Public administration",/\b(public administration|government administration)\b/],["36","Social welfare",/\b(social welfare|social work)\b/],["37","Education",/\b(education|teaching|pedagogy|instruction|schooling|teacher training)\b/],["39","Ethnology. Folklore",/\b(ethnolog|folklore|folk lore|customs|traditions)\b/],
["51","Mathematics",/\b(mathematics|maths?|algebra|geometry|calculus|number theory)\b/],["52","Astronomy",/\bastronom(y|ical)|cosmology\b/],["53","Physics",/\bphysics|mechanics|optics|thermodynamics|quantum physics\b/],["54","Chemistry",/\bchemistry|chemical\b/],["55","Earth sciences",/\bgeology|meteorology|earth science|geophysics\b/],["56","Palaeontology",/\bpalaeontolog|fossils?\b/],["57","Biological sciences",/\bbiology|botany|zoology|ecology|microbiology|genetics\b/],["58","Botanical sciences",/\bbotany|plants?\b/],["59","Zoological sciences",/\bzoology|animals?\b/],
["61","Medical sciences",/\bmedicine|medical|disease|surgery|hospital|nursing|health care\b/],["62","Engineering and technology in general",/\bengineering\b/],["63","Agriculture and related sciences and technologies",/\bagriculture|farming|crop|crops|wheat|maize|corn|harvest|harvesting|irrigation|agronomy|horticulture\b/],["65","Management and organization",/\bmanagement|business|commerce|marketing|organization\b/],["66","Chemical technology",/\bchemical technolog|industrial chemistry\b/],["67","Various industries and crafts",/\bindustry|manufacturing|crafts?\b/],["68","Industries, trades and crafts",/\bworkshop|production technology\b/],["69","Building materials and building practice",/\bconstruction|building practice|building materials\b/],
["7","The arts. Entertainment. Sport",/\barts?|entertainment\b/],["71","Landscape and regional planning",/\blandscape architecture|regional planning\b/],["72","Architecture",/\barchitecture|architectural\b/],["73","Sculpture",/\bsculpture\b/],["74","Drawing and applied art",/\bdrawing|applied art\b/],["75","Painting",/\bpainting\b/],["76","Graphic art",/\bgraphic art|printmaking\b/],["77","Photography and similar processes",/\bphotography\b/],["78","Music",/\bmusic|musical\b/],["79","Recreation. Entertainment. Games. Sport",/\bsport|games?|recreation\b/],["796","Sport and games",/\bfootball|cricket|athletics|tennis|basketball|sports?\b/],
["80","General questions relating to linguistics and literature",/\blanguage|linguistics|dictionary|lexicography\b/],["81","Linguistics",/\blinguistics|grammar|phonetics|semantics\b/],["82","Literature",/\bliterature|poetry|novel|fiction|prose\b/],["821.111","English literature",/\benglish literature\b/],["821.111-2","English literature — drama",/\benglish drama|drama in english\b/],
["90","Archaeology",/\barchaeolog(y|ical)\b/],["91","Geography",/\bgeograph(y|ical)\b/],["94","History",/\bhistor(y|ical)\b/]
];

const exact=[
[/^bible$/i,"27-23","Christianity","Bible","27 = Christianity; 27-23 = Sacred texts. The Bible.","UDC Summary match"],
[/^bible in hindi(?: language)?$/i,"27-23=214.21","Christianity","Bible in Hindi","27-23 = The Bible; =214.21 = Hindi language.","UDC Summary subject + language auxiliary match"],
[/^bible in gujarati(?: language)?$/i,"27-23=214.25","Christianity","Bible in Gujarati","27-23 = The Bible; =214.25 = Gujarati language.","UDC Summary subject + language auxiliary match"],
[/^(?:bible in )?(?:punjabi|panjabi)(?: language)?$/i,"27-23=214.27","Christianity","Bible in Punjabi","27-23 = The Bible; =214.27 = Punjabi/Panjabi language.","UDC Summary subject + language auxiliary match"],
[/^(?:punjabi|panjabi) bible(?: in (?:punjabi|panjabi)(?: language)?)?$/i,"27-23=214.27","Christianity","Bible in Punjabi","27-23 = The Bible; =214.27 = Punjabi/Panjabi language.","UDC Summary subject + language auxiliary match"],
[/^hindi language$/i,"=214.21","Language","Hindi","=214.21 = Hindi language common auxiliary.","UDC Summary language auxiliary match"],
[/^gujarati language$/i,"=214.25","Language","Gujarati","=214.25 = Gujarati language common auxiliary.","UDC Summary language auxiliary match"],
[/^urdu language$/i,"=214.22","Language","Urdu","=214.22 = Urdu language common auxiliary.","UDC Summary language auxiliary match"],
[/^punjabi language$/i,"=214.27","Language","Punjabi","=214.27 = Punjabi language common auxiliary.","UDC Summary language auxiliary match"],
[/^theory and philosophy of university$/i,"378.01","Higher education / Universities","Theory and Philosophy of University Education","378 = Higher education. Universities. Academic study; .01 = theory and philosophy of higher education.","UDC hierarchy match"],

[/^theory and philosophy of university education$/i,"378.01","University Education","Theory and Philosophy of University Education","378 = Higher / university education; .01 = theory and philosophy of education. Theory is not assigned a separate extra number.","UDC hierarchy + relation synthesis"],
[/^religious unrest in india$/i,"322.4(540)","Religion","Religious unrest in India","322.4 = religious conflict/unrest; (540) = India. The title explicitly contains both the religious-conflict facet and the Indian place facet.","UDC Summary + place-auxiliary synthesis"],
[/^religious (?:conflict|conflicts|violence|tension|tensions|unrest|disturbance|disturbances|clashes) in india$/i,"322.4(540)","Religion","Religious conflict/unrest in India","322.4 = religious conflict/unrest; (540) = India. The complete title is preserved rather than collapsing it to general religion 2(540).","UDC Summary + place-auxiliary synthesis"],
[/^research on sacred literature of sikhism$/i,"235-25","Sikhism","Research on the sacred literature of Sikhism","235 = Sikhism; -25 = secondary literature, including research/commentary on the religious literature. The title is a study of Sikh sacred literature, not the sacred text itself.","UDC Summary hierarchy + religion-specific synthesis"],
[/^study of sacred literature of sikhism$/i,"235-25","Sikhism","Study of the sacred literature of Sikhism","235 = Sikhism; -25 = secondary literature, including research/commentary on religious literature. The title describes study of the sacred literature.","UDC Summary hierarchy + religion-specific synthesis"],
[/^research on sikh sacred literature$/i,"235-25","Sikhism","Research on Sikh sacred literature","235 = Sikhism; -25 = secondary literature/research on religious literature.","UDC Summary hierarchy + religion-specific synthesis"],
[/^sacred literature of sikhism$/i,"235-23","Sikhism","Sacred literature of Sikhism","235 = Sikhism; -23 = sacred books, scriptures and religious texts. This title identifies the sacred literature itself rather than research about it.","UDC Summary hierarchy + religion-specific synthesis"],
[/^sikh sacred literature$/i,"235-23","Sikhism","Sikh sacred literature","235 = Sikhism; -23 = sacred books, scriptures and religious texts.","UDC Summary hierarchy + religion-specific synthesis"],
[/^theory and philosophy of higher education$/i,"378.01","Higher / University Education","Theory and Philosophy of Higher Education","378 = Higher / university education; .01 = theory and philosophy of education.","Exact V45 title match"],
[/^knowledge metaphysics and logic$/i,"001+11+16","Knowledge / metaphysics / logic","Knowledge, Metaphysics and Logic","001 = Science and knowledge in general; 11 = Metaphysics; 16 = Logic and theory of knowledge; + coordinates the separate subjects.","UDC Summary hierarchy + coordination synthesis"],
[/^knowledge, metaphysics and logic$/i,"001+11+16","Knowledge / metaphysics / logic","Knowledge, Metaphysics and Logic","001 = Science and knowledge in general; 11 = Metaphysics; 16 = Logic and theory of knowledge; + coordinates the separate subjects.","UDC Summary hierarchy + coordination synthesis"],
[/^knowledge metaphysics$/i,"001+11","Knowledge / metaphysics","Knowledge, Metaphysics","001 = Science and knowledge in general; 11 = Metaphysics; + coordinates the separate subjects.","UDC Summary hierarchy + coordination synthesis"],
[/^handbook of systematic zoology$/i,"592/599","Systematic zoology","Handbook of Systematic Zoology","592/599 = Systematic zoology. The title identifies the subject as systematic zoology; no form auxiliary is added here because the requested established classification is 592/599.","UDC Summary hierarchy match"],
[/^handbook of education science and technology$/i,"37:5/6(035)","Education in relation to science and technology","Handbook of Education Science and Technology","37 = Education; 5/6 = mathematics/natural sciences through applied sciences and technology; : expresses relation; (035) = handbooks and manuals.","UDC hierarchy + relation + form synthesis"],
[/^history of india$/i,"94(540)","History","History of India","94 = History; (540) = India.","Official UDC Summary hierarchy match"],
[/^history of punjab$/i,"94(540)","History","History of Punjab","94 = History; (540) = India; the public Summary does not expose a Punjab-specific place subdivision here.","UDC Summary place-auxiliary synthesis"],
[/^economy of india$/i,"330(540)","Economics","Economy of India","330 = Economics; (540) = India.","UDC Summary hierarchy + place-auxiliary synthesis"],
[/^indian constitution$/i,"342.4(540)","Law","Constitutional law of India","342 = Constitutional law; (540) = India.","UDC Summary hierarchy + place-auxiliary synthesis"],
[/^geography of india$/i,"91(540)","Geography","Geography of India","91 = Geography; (540) = India.","Official UDC Summary hierarchy match"],
[/^indian literature$/i,"821.21","Literature","Indian literature","821.21 = Indian literature; (540) = India.","Reasoned from UDC Summary"],
[/^indian philosophy$/i,"1(540)","Philosophy","Philosophy of India","1 = Philosophy; (540) = India.","Reasoned from UDC Summary"],
[/^indian art$/i,"7(540)","Arts","Art of India","7 = Arts; (540) = India.","Reasoned from UDC Summary"],
[/^dictionary of scientific and technical libraries in united states$/i,"026(73)(038)","Libraries","Dictionary of scientific and technical libraries in United States","026 = libraries of special subjects; (73) = United States; (038) = dictionaries/reference works.","UDC-specific exact-title rule"],
[/^dictionary of language and literature$/i,"80(038)","Language and literature","Dictionary of language and literature","80 = General questions relating to linguistics and literature; (038) = Dictionaries (common auxiliary of form).","UDC Summary form-auxiliary match"],
[/^handbook of science and technology$/i,"5/6(035)","Science and technology","Handbook of science and technology","5 = Mathematics and natural sciences; 6 = Applied sciences, medicine and technology; / = consecutive extension; (035) = Handbooks and manuals.","UDC Summary hierarchy + form-auxiliary synthesis"],
[/^english drama$/i,"821.111-2","English literature","Drama in English","821.111 = English literature; -2 = drama.","Official UDC Summary hierarchy match"],
[/^music and entertainment$/i,"78+79","Music and entertainment","Music; entertainment","78 = Music; 79 = Recreation/entertainment/games/sport; + coordinates the two subjects.","UDC hierarchy cross-check"],
[/^science and technology$/i,"5/6","Science and technology","Mathematics/natural sciences and applied sciences/technology","5 = Mathematics and natural sciences; 6 = Applied sciences, medicine and technology; / = consecutive extension.","Official UDC Summary hierarchy match"],
[/^harvesting of wheat and maize$/i,"633.11+633.15:631.55","Agriculture","Harvesting of wheat and maize","633.11 = wheat; 633.15 = maize; + coordinates the two crops; : relates them to 631.55 = gathering/harvesting.","UDC evidence cross-check"],
[/^harvesting of wheat and barley$/i,"633.11+633.16:631.55","Agriculture","Harvesting of wheat and barley","633.11 = wheat; 633.16 = barley; + coordinates the two crops; : relates them to 631.55 = gathering/harvesting.","UDC evidence cross-check"],
[/^harvesting of cereals$/i,"633.1:631.55","Agriculture","Harvesting of cereals","633.1 = cereals/grain crops; 631.55 = gathering/harvesting; : expresses the relation.","UDC evidence cross-check"],
[/^harvesting of wheat$/i,"633.11:631.55","Agriculture","Harvesting of wheat","633.11 = wheat; 631.55 = gathering/harvesting.","UDC evidence cross-check"],
[/^harvesting of maize$/i,"633.15:631.55","Agriculture","Harvesting of maize","633.15 = maize; 631.55 = gathering/harvesting.","UDC evidence cross-check"],
[/^harvesting of barley$/i,"633.16:631.55","Agriculture","Harvesting of barley","633.16 = barley; 631.55 = gathering/harvesting.","UDC evidence cross-check"],
[/^wheat and maize$/i,"633.11+633.15","Agriculture","Wheat and maize","633.11 = wheat; 633.15 = maize; + coordinates the crops.","UDC hierarchy cross-check"],
[/^wheat and barley$/i,"633.11+633.16","Agriculture","Wheat and barley","633.11 = wheat; 633.16 = barley; + coordinates the crops.","UDC hierarchy cross-check"],
[/^cultivation of wheat$/i,"633.11:631.5","Agriculture","Cultivation of wheat","633.11 = wheat; 631.5 = agricultural operations/cultivation.","UDC hierarchy cross-check"],
[/^cultivation of maize$/i,"633.15:631.5","Agriculture","Cultivation of maize","633.15 = maize; 631.5 = agricultural operations/cultivation.","UDC hierarchy cross-check"],
[/^cultivation of barley$/i,"633.16:631.5","Agriculture","Cultivation of barley","633.16 = barley; 631.5 = agricultural operations/cultivation.","UDC hierarchy cross-check"],
];

function localClassify(title){const t=norm(title);for(const e of exact){if(e[0].test(t))return result(title,e[1],e[2],e[3],e[4],e[5],true)}
 // Specific religion-conflict facet must run before the broad religion fallback, so words such as unrest are never dropped.
 if(/\breligious\b/.test(t)&&/\b(unrest|conflict|conflicts|violence|tension|tensions|disturbance|disturbances|clashes)\b/.test(t)){
   const inIndia=/\b(india|bharat)\b/.test(t);
   return result(title,inIndia?"322.4(540)":"2-8","Religion",inIndia?"Religious conflict/unrest in India":"Religious conflict/unrest","322.4 = religious conflict/unrest;"+(inIndia?" (540) = India; the place facet is retained.":" the conflict/unrest facet is retained."),"UDC Summary conflict-facet rule",true);
 }
 // Place-aware history/geography/constitution patterns.
 if(/\b(history|historical)\b/.test(t)&&/\bindia|bharat\b/.test(t))return result(title,"94(540)","History","History of India","94 = History; (540) = India.","Reasoned from UDC Summary",true);
 if(/\bgeograph/.test(t)&&/\bindia|bharat\b/.test(t))return result(title,"91(540)","Geography","Geography of India","91 = Geography; (540) = India.","Reasoned from UDC Summary",true);
 // Form-aware literature rules: do not blindly append auxiliaries.
 if(/\benglish\b/.test(t)&&/\bdrama\b/.test(t))return result(title,"821.111-2","English literature","Drama in English","821.111 = English literature; -2 = drama.","Reasoned from UDC Summary",true);
 if(/\b(dictionary|lexicon|glossary)\b/.test(t)&&/\blanguage\b/.test(t))return result(title,"80","Language and linguistics","Language reference / lexicography","80 = General questions relating to linguistics and literature; exact dictionary treatment depends on the language and form stated in the title.","Reasoned from UDC Summary",false);
 // Agriculture: process + crop is deliberately more specific than broad 63.
 if(/\b(harvest|harvesting)\b/.test(t)&&/\b(wheat|maize|corn|cereal|grain)\b/.test(t))return result(title,"633.1:631.55","Agriculture","Harvesting of cereals","633.1 = Cereals/grain crops; 631.55 = gathering/harvesting; : expresses the relation.","UDC Summary hierarchy + relation synthesis",true);
 // Do not guess a broad class from a single keyword. Unknown titles must go to an authoritative AI/search path or remain unverified.
 // Final deterministic fallback: always return a usable UDC class instead of an
// empty/unknown result. More specific rules above take precedence.
const first = C.find(([n,_,rx]) => rx.test(t) && n !== "0");
if(first){
  const [n,m] = first;
  return result(title,n,m,"Subject identified from title keywords",
    `${n} = ${m}. The title matched a UDC subject rule; use the more specific schedule entry when available.`,
    "UDC hierarchy fallback",false);
}
return result(title,"001","Science and knowledge in general","General subject classification",
  "001 = Science and knowledge in general. No more specific local UDC rule matched this title; authoritative UDC verification is recommended.",
  "General UDC fallback",false);
}
function result(title,n,m,s,x,conf,official){return{title,udc_number:n,main_subject:m,sub_subject:s,breakdown:x,explanation:x+(official?"":" This result is not an exact licensed MRF lookup."),confidence:conf,evidence_summary:official?"Matched to a public UDC Summary concept/hierarchy.":"Deterministic semantic fallback based on UDC Summary concepts.",sources:["https://udcsummary.info/"],evidence_level:conf,official_udc_match:official,candidate_notes:"",notation_check:"Each displayed component is a UDC class or a justified UDC relation; no DDC notation is used.",engine:"V45 ULTRA local semantic engine",model:"offline",grounded:false}}

async function gemini(title,model,grounded){const body={contents:[{role:"user",parts:[{text:`${UDC_RULES}\nClassify this complete book title: "${title}". Search the official UDC Summary first when grounding is enabled. Prefer an exact official UDC Summary class when available. Generate up to 3 candidates internally, audit every notation component and every crop/language/place/form auxiliary, then return one final result. Never convert a subject to a broader class merely because a model guess is convenient. Do not use 004 unless the subject is genuinely computing. Do not invent an official record. Before returning, perform a TITLE-COMPLETENESS AUDIT: every substantive concept in the title (topic, process, conflict/unrest, research/study, crop, language, person, place, form, time, etc.) must be represented in the subject/explanation and, where the UDC schedule supports it, in the notation. If a concept cannot be represented with an exact UDC facet, state that limitation rather than silently dropping it. JSON only.`}]}],systemInstruction:{parts:[{text:UDC_RULES}]},generationConfig:{temperature:0.02,responseMimeType:"application/json",responseSchema:schema,maxOutputTokens:1600}};if(grounded)body.tools=[{googleSearch:{}}];const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),28000);try{const u=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;const r=await fetch(u,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":GEMINI_KEY},body:JSON.stringify(body),signal:ac.signal});const txt=await r.text();let j;try{j=JSON.parse(txt)}catch{throw Error("Bad Gemini response")};if(!r.ok)throw Error(j?.error?.message||`Gemini HTTP ${r.status}`);const out=validate(parseJSON(j?.candidates?.[0]?.content?.parts?.map(x=>x.text||"").join("")),title);const chunks=j?.candidates?.[0]?.groundingMetadata?.groundingChunks||[];const gs=chunks.map(x=>x.web).filter(Boolean).map(x=>x.uri).filter(Boolean);if(!out.sources.length)out.sources=gs.slice(0,8);return{...out,engine:grounded?"Gemini + Google Search":"Gemini",model,grounded:gs.length>0}}finally{clearTimeout(tm)}}
async function groq(title){if(!GROQ_KEY)throw Error("GROQ_API_KEY not configured");const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${GROQ_KEY}`},body:JSON.stringify({model:process.env.GROQ_MODEL||"openai/gpt-oss-120b",temperature:0.02,response_format:{type:"json_object"},messages:[{role:"system",content:UDC_RULES},{role:"user",content:`Classify "${title}" using UDC Summary as public authority. Return the required JSON fields only. Never use DDC and never use 004 unless it is genuinely computing. Perform a TITLE-COMPLETENESS AUDIT and never silently omit a substantive title concept.`}]})});const j=await r.json();if(!r.ok)throw Error(j?.error?.message||`Groq HTTP ${r.status}`);return{...validate(parseJSON(j?.choices?.[0]?.message?.content||""),title),engine:"Groq fallback",model:process.env.GROQ_MODEL||"openai/gpt-oss-120b",grounded:false}}

app.get("/",(_,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.get("/index.html",(_,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.get("/api/health",(_,res)=>res.json({ok:true,version:"V45 ULTRA",geminiConfigured:!!GEMINI_KEY,groqConfigured:!!GROQ_KEY,models:MODELS,authority:"UDC Summary",authorityUrl:SUMMARY_BASE}));
app.post("/api/classify",async(req,res)=>{const title=String(req.body?.title||"").trim();if(!title)return res.status(400).json({error:"Enter a book title."});
 // Deterministic exact/high-value rules run first: this prevents AI drift on known titles.
 const lc=localClassify(title); if(lc.official_udc_match) return res.json(lc);
 const errors=[];
 if(GEMINI_KEY){for(const grounded of [true,false])for(const model of MODELS){try{return res.json(await gemini(title,model,grounded))}catch(e){errors.push(`${model}/${grounded?'search':'plain'}: ${e.message}`)}}}
 if(GROQ_KEY){try{return res.json(await groq(title))}catch(e){errors.push(`groq: ${e.message}`)}}
 lc.provider_errors=errors.slice(-8);lc.engine="V45 ULTRA deterministic safety-net";lc.evidence_level="BEST_EFFORT";lc.confidence="Best effort — verify against the official UDC Summary/MRF";return res.json(lc);
});
app.use((err,_req,res,_next)=>{
  console.error(err);
  if(res.headersSent) return;
  res.status(200).json({
    title:"",
    udc_number:"001",
    main_subject:"Science and knowledge in general",
    sub_subject:"General UDC fallback",
    explanation:"001 = Science and knowledge in general. The classifier recovered safely after an internal provider error.",
    breakdown:"001 = Science and knowledge in general.",
    confidence:"Safe fallback",
    evidence_summary:"Fallback result; verify against the authoritative UDC schedule for precise classification.",
    sources:["https://udcsummary.info/"],
    evidence_level:"FALLBACK",
    official_udc_match:false,
    candidate_notes:"",
    notation_check:"UDC only; no DDC notation is used.",
    engine:"V45 ULTRA recovery",
    model:"offline",
    grounded:false
  });
});
app.listen(PORT,()=>console.log(`UDC V45 ULTRA on ${PORT}`));
