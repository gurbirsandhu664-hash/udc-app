const express=require("express");
const cors=require("cors");
const fs=require("fs");
const path=require("path");

const app=express();
app.use(cors());
app.use(express.json({limit:"1mb"}));
app.use(express.static(__dirname));

const RULES=JSON.parse(fs.readFileSync(path.join(__dirname,"udc-rules.json"),"utf8"));

function norm(s){
  return String(s||"").toLowerCase().normalize("NFKD")
    .replace(/[’']/g,"'")
    .replace(/[^a-z0-9=:.()+/\\- ]+/g," ")
    .replace(/\s+/g," ").trim();
}
function tokens(s){return new Set(norm(s).split(" ").filter(Boolean));}
function hasWord(t,p){
  const q=norm(p);
  if(!q)return false;
  if(q.includes(" "))return t.includes(q);
  return tokens(t).has(q);
}
function anyWord(t,arr){return arr.some(x=>hasWord(t,x));}
function findRule(list,t){
  return (list||[]).find(r=>anyWord(t,r.patterns||r.pattern||[]));
}
function exactRule(list,t){
  return (list||[]).find(r=>t===norm(r.pattern));
}
function output(title,r,confidence="High"){
  return {
    title,bookTitle:title,
    udc:r.udc||"",finalUdcNumber:r.udc||"",proposedUdcNumber:r.udc||"",
    mainClass:r.mainClass||"",
    subject:r.subject||"",mainSubject:r.subject||"",
    subSubject:r.subSubject||"",
    confidence,
    explanation:r.explanation||"",
    cataloguerExplanation:r.explanation||"",
    aux:r.aux||[],alternatives:r.alternatives||[],
    verifiedRule:confidence==="High",
    source:"UDC Ultimate V7 local rule engine"
  };
}

/* Remove question wrappers only; never remove meaningful subject words. */
function cleanQuestion(s){
  let t=norm(s);
  t=t.replace(/^(please\\s+)?(what is|what's|what are|which is|which are|give me|give|find|show me|show|tell me|provide|identify)\\s+/,"");
  t=t.replace(/^the\\s+(udc\\s+)?(number|classification|class|code)\\s+(for|of)\\s+/,"");
  t=t.replace(/^(udc\\s+)?(number|classification|class|code)\\s+(for|of)\\s+/,"");
  t=t.replace(/\\b(please)\\b/g,"").trim();
  return t;
}

/* Exact compound subjects are deliberately checked before single-word subjects. */
const COMPOUNDS=[
  {p:["science and arts","arts and science"],u:"5+7",m:"5+7",s:"Mathematics and natural sciences + Arts",ss:"Coordination of subjects",e:"5 = Mathematics and natural sciences; + = coordination; 7 = Arts."},
  {p:["science and technology","science & technology"],u:"5/6",m:"5/6",s:"Mathematics and natural sciences through applied sciences, medicine and technology",ss:"Science and technology",e:"5/6 = consecutive extension from class 5 through class 6."},
  {p:["heart disease","heart diseases","cardiovascular disease","cardiovascular diseases","coronary heart disease","coronary disease"],u:"616.1",m:"616.1",s:"Diseases of the circulatory system",ss:"Heart and cardiovascular diseases",e:"616.1 = diseases of the circulatory system and cardiovascular complaints."},
  {p:["heart attack","myocardial infarction"],u:"616.1",m:"616.1",s:"Diseases of the circulatory system",ss:"Heart disease / myocardial infarction",e:"616.1 = diseases of the circulatory system; the title specifies myocardial infarction/heart attack."},
  {p:["blood pressure","hypertension"],u:"616.1",m:"616.1",s:"Diseases of the circulatory system",ss:"Blood pressure / hypertension",e:"616.1 = diseases and disorders of the circulatory system."},
  {p:["history of india"],u:"94(540)",m:"94",s:"History of India",ss:"History — India",e:"94 = General history; (540) = India."},
  {p:["geography of india"],u:"91(540)",m:"91",s:"Geography of India",ss:"Geography — India",e:"91 = Geography; (540) = India."},
  {p:["history of punjab"],u:"94(540.15)",m:"94",s:"History of Punjab",ss:"History — Punjab",e:"94 = General history; (540.15) = Punjab."},
  {p:["indian constitution"],u:"342(540)",m:"342",s:"Constitutional law of India",ss:"Constitution — India",e:"342 = constitutional law; (540) = India."},
  {p:["economy of india","indian economy"],u:"330(540)",m:"330",s:"Economy of India",ss:"Economics — India",e:"330 = Economics; (540) = India."},
  {p:["indian philosophy"],u:"1(540)",m:"1",s:"Philosophy of India",ss:"Philosophy — India",e:"1 = Philosophy; (540) = India."},
  {p:["indian art"],u:"7(540)",m:"7",s:"Art of India",ss:"Arts — India",e:"7 = Arts; (540) = India."}
];

const MEDICAL=[
  ["respiratory disease","respiratory diseases","lung disease","lung diseases","pulmonary disease","616.2","Diseases of the respiratory system","Respiratory diseases"],
  ["digestive disease","digestive diseases","gastrointestinal disease","digestive system disease","616.3","Diseases of the digestive system","Digestive diseases"],
  ["skin disease","skin diseases","dermatology","cutaneous disease","616.5","Diseases of the skin","Dermatology"],
  ["urinary disease","urogenital disease","urological disease","616.6","Diseases of the urogenital system","Urology / urogenital diseases"],
  ["bone disease","musculoskeletal disease","musculoskeletal diseases","616.7","Diseases of locomotor organs","Musculoskeletal diseases"],
  ["neurological disease","neurological diseases","nervous system disease","nervous system diseases","neurology","616.8","Neurology and neuropathology","Nervous system diseases"],
  ["psychiatric disease","psychiatric diseases","psychiatry","psychopathology","616.89","Psychiatric pathology","Psychiatry / psychopathology"],
  ["infectious disease","infectious diseases","616.9","Infectious diseases","Infectious diseases"],
  ["cancer","oncology","tumour","tumor","neoplasm","616-006","Tumours and neoplasms","Oncology"]
];

function classify(raw){
  const original=String(raw||"").trim();
  if(!original)return output("",{udc:"0",mainClass:"0",subject:"Generalities",subSubject:"General works",explanation:"0 = Generalities."},"Low");
  let t=cleanQuestion(original);

  // 1. Exact and high-priority compound subjects.
  for(const c of COMPOUNDS){
    if(c.p.some(p=>t===norm(p))){
      return output(original,{udc:c.u,mainClass:c.m,subject:c.s,subSubject:c.ss,
        explanation:c.e}, "High");
    }
  }

  // 2. Medical phrase detection BEFORE generic "art", "science", etc.
  for(const m of MEDICAL){
    const phrases=m.slice(0,-3);
    if(phrases.some(p=>t.includes(norm(p)))){
      const u=m[m.length-3], s=m[m.length-2], ss=m[m.length-1];
      return output(original,{udc:u,mainClass:u,subject:s,subSubject:ss,
        explanation:`${u} = ${s}; title detected as ${ss}.`},"High");
    }
  }

  // 3. Two-place international relations. Whole-word place matching.
  const ps=(RULES.places||[]).filter(p=>anyWord(t,p.patterns||[]));
  if(ps.length>=2 && anyWord(t,["relation","relations","relationship","relationships","diplomacy","diplomatic","bilateral","foreign policy","foreign affairs","international relations","cooperation","ties between"])){
    const a=ps[0],b=ps[1];
    return output(original,{udc:`327${a.code}:${b.code}`,mainClass:"327",
      subject:`${a.name}–${b.name} international relations`,subSubject:"International / foreign relations",
      aux:[{type:"place",code:a.code,name:a.name},{type:"relation",code:":",name:"Relation"},{type:"place",code:b.code,name:b.name}],
      explanation:`327 = international relations; ${a.code} = ${a.name}; : = relation; ${b.code} = ${b.name}.`},"High");
  }

  // 4. Official/local exact answer-key entries.
  const ex=exactRule(RULES.exact||[],t);
  if(ex)return output(original,ex,"High");

  // 5. Language/literature before generic language, literature or form rules.
  const lang=findRule(RULES.languages||[],t);
  if(lang){
    if(anyWord(t,["dictionary","lexicon","glossary"])){
      return output(original,{udc:`${lang.languageClass}(038)`,mainClass:"811",
        subject:`${lang.name} language — dictionary / lexicon`,subSubject:"Dictionary",
        aux:[{type:"language",code:lang.languageClass,name:lang.name},{type:"form",code:"(038)",name:"Dictionary / lexicon"}],
        explanation:`${lang.languageClass} = ${lang.name} language; (038) = dictionary / lexicon form.`},"High");
    }
    if(anyWord(t,["drama","play","theatre","theater","poetry","poem","fiction","novel","short story","short stories","literature"])){
      let suffix="",form="Literature";
      if(anyWord(t,["drama","play","theatre","theater"])){suffix="-2";form="Drama";}
      else if(anyWord(t,["poetry","poem"])){suffix="-1";form="Poetry";}
      else if(anyWord(t,["fiction","novel","short story","short stories"])){suffix="-3";form="Fiction";}
      return output(original,{udc:`${lang.litCode}${suffix}`,mainClass:"821",
        subject:`${lang.name} literature — ${form}`,subSubject:form,
        aux:[{type:"language",code:lang.litCode,name:lang.name}],
        explanation:`${lang.litCode} = literature in ${lang.name}; ${suffix||"general"} = ${form}.`},"High");
    }
    if(hasWord(t,"grammar")){
      return output(original,{udc:`${lang.languageClass}.5`,mainClass:"811",
        subject:`${lang.name} grammar`,subSubject:"Grammar",
        aux:[{type:"language",code:lang.languageClass,name:lang.name}],
        explanation:`${lang.languageClass} = ${lang.name} language; grammar specified by title. Verify detailed subdivision against the authoritative schedule.`},"Medium");
    }
    return output(original,{udc:lang.languageClass,mainClass:"811",subject:`${lang.name} language`,
      subSubject:"Language / linguistics",aux:[{type:"language",code:lang.languageClass,name:lang.name}],
      explanation:`${lang.languageClass} = ${lang.name} language.`},"High");
  }

  // 6. Specific subject rule. Whole-word matching prevents heart -> art.
  const sr=findRule(RULES.subjects||[],t);
  if(sr){
    let udc=sr.udc,aux=[];
    const form=findRule(RULES.forms||[],t);
    if(form){udc+=form.code;aux.push({type:"form",code:form.code,name:form.name});}
    const place=(RULES.places||[]).find(p=>anyWord(t,p.patterns||[]));
    if(place && !anyWord(t,["relation","relations","foreign","diplomatic"])){
      udc+=place.code;aux.push({type:"place",code:place.code,name:place.name});
    }
    return output(original,{...sr,udc,mainClass:sr.udc,aux,
      explanation:sr.explanation+(aux.length?` Added: ${aux.map(x=>x.code).join(" ")}.`:"")},"Medium");
  }

  // 7. Form without a subject: do not invent a class.
  const form=findRule(RULES.forms||[],t);
  if(form){
    return output(original,{udc:"",mainClass:"",subject:"Form identified; subject not sufficiently specific",
      subSubject:form.name,aux:[{type:"form",code:form.code,name:form.name}],
      explanation:`${form.code} = ${form.name}. A subject class is required before assigning the final UDC number.`},"Low");
  }

  // 8. Broad semantic fallback: common titles get a useful UDC starting point.
  // Matching is whole-word/phrase based, so ART cannot match HEART.
  const broad=[
    {p:["art","arts","painting","sculpture","drawing","design"],u:"7",m:"7",s:"Arts",ss:"General arts",e:"7 = Arts."},
    {p:["science","scientific","natural science","natural sciences"],u:"5",m:"5",s:"Mathematics and natural sciences",ss:"General science",e:"5 = Mathematics and natural sciences."},
    {p:["technology","technological","technical"],u:"6",m:"6",s:"Applied sciences, medicine and technology",ss:"Technology",e:"6 = Applied sciences, medicine and technology."},
    {p:["medicine","medical","health","healthcare","hospital","clinical"],u:"61",m:"61",s:"Medical sciences",ss:"Medicine / health",e:"61 = Medical sciences."},
    {p:["history","historical"],u:"94",m:"94",s:"General history",ss:"History",e:"94 = General history."},
    {p:["geography","geographical","geographic"],u:"91",m:"91",s:"Geography",ss:"Geography",e:"91 = Geography."},
    {p:["philosophy","philosophical"],u:"1",m:"1",s:"Philosophy",ss:"Philosophy",e:"1 = Philosophy."},
    {p:["religion","religious","theology"],u:"2",m:"2",s:"Religion and theology",ss:"Religion / theology",e:"2 = Religion and theology."},
    {p:["politics","political","government","governance"],u:"32",m:"32",s:"Politics",ss:"Political science / government",e:"32 = Politics."},
    {p:["law","legal","legislation","legislative"],u:"34",m:"34",s:"Law",ss:"Law / legislation",e:"34 = Law."},
    {p:["education","teaching","teacher","pedagogy","school"],u:"37",m:"37",s:"Education",ss:"Education / teaching",e:"37 = Education."},
    {p:["economics","economic","economy","finance","financial"],u:"33",m:"33",s:"Economics",ss:"Economics / finance",e:"33 = Economics."},
    {p:["sociology","society","social"],u:"316",m:"316",s:"Sociology",ss:"Social sciences / sociology",e:"316 = Sociology."},
    {p:["psychology","psychological"],u:"159.9",m:"159.9",s:"Psychology",ss:"Psychology",e:"159.9 = Psychology."},
    {p:["computer","computers","computing","informatics","information technology","software","programming"],u:"004",m:"004",s:"Computer science and technology",ss:"Computing / IT",e:"004 = Computer science and technology."},
    {p:["engineering"],u:"62",m:"62",s:"Engineering and technology",ss:"Engineering",e:"62 = Engineering and technology."},
    {p:["agriculture","agricultural","farming","crop","crops"],u:"63",m:"63",s:"Agriculture and related sciences",ss:"Agriculture",e:"63 = Agriculture and related sciences."},
    {p:["biology","biological","life science","life sciences"],u:"57",m:"57",s:"Biological sciences",ss:"Biology",e:"57 = Biological sciences."},
    {p:["botany","plant","plants"],u:"58",m:"58",s:"Botany",ss:"Botany / plants",e:"58 = Botany."},
    {p:["zoology","animal","animals","wildlife"],u:"59",m:"59",s:"Zoology",ss:"Zoology / animals",e:"59 = Zoology."},
    {p:["physics","physical"],u:"53",m:"53",s:"Physics",ss:"Physics",e:"53 = Physics."},
    {p:["chemistry","chemical"],u:"54",m:"54",s:"Chemistry",ss:"Chemistry",e:"54 = Chemistry."},
    {p:["astronomy","astronomical","space science"],u:"52",m:"52",s:"Astronomy",ss:"Astronomy",e:"52 = Astronomy."},
    {p:["geology","geological","earth science","earth sciences"],u:"55",m:"55",s:"Earth sciences",ss:"Geology / earth sciences",e:"55 = Earth sciences."},
    {p:["mathematics","math","mathematical","algebra","geometry","calculus"],u:"51",m:"51",s:"Mathematics",ss:"Mathematics",e:"51 = Mathematics."},
    {p:["music","musical"],u:"78",m:"78",s:"Music",ss:"Music",e:"78 = Music."},
    {p:["architecture","architectural"],u:"72",m:"72",s:"Architecture",ss:"Architecture",e:"72 = Architecture."},
    {p:["photography","photographic"],u:"77",m:"77",s:"Photography",ss:"Photography",e:"77 = Photography."},
    {p:["literature","literary","novel","fiction","poetry","poem","drama","play"],u:"82",m:"82",s:"Literature",ss:"Literature",e:"82 = Literature."},
    {p:["language","linguistics","linguistic","grammar"],u:"81",m:"81",s:"Linguistics and languages",ss:"Language / linguistics",e:"81 = Linguistics and languages."},
    {p:["library","librarianship","library science"],u:"02",m:"02",s:"Librarianship and library science",ss:"Libraries",e:"02 = Librarianship and library science."},
    {p:["journalism","newspaper","newspapers","media","mass communication"],u:"070",m:"070",s:"Newspapers and journalism",ss:"Journalism / media",e:"070 = Newspapers and journalism."},
    {p:["tourism","tourist","travel"],u:"338.48",m:"338.48",s:"Tourism",ss:"Tourism / travel",e:"338.48 = Tourism."}
  ];
  const b=broad.find(x=>anyWord(t,x.p));
  if(b){
    let u=b.u,aux=[];
    const form=findRule(RULES.forms||[],t);
    if(form){u+=form.code;aux.push({type:"form",code:form.code,name:form.name});}
    const place=(RULES.places||[]).find(x=>anyWord(t,x.patterns||[]));
    if(place){u+=place.code;aux.push({type:"place",code:place.code,name:place.name});}
    return output(original,{udc:u,mainClass:b.m,subject:b.s,subSubject:b.ss,aux,
      explanation:b.e+(aux.length?` Added: ${aux.map(x=>x.code).join(" ")}.`:"")},
      form?"Medium":"Low");
  }

  // 9. Only genuinely unrecognized titles reach generalities.
  return output(original,{udc:"0",mainClass:"0",subject:"Generalities",
    subSubject:"Unclassified / general work",
    explanation:"0 = Generalities. No specific local subject family was detected; this is a broad fallback, not an exact detailed classification."},"Low"););
}
const PORT=process.env.PORT||10000;
app.listen(PORT,()=>console.log(`UDC Ultimate V8 listening on ${PORT}`));
