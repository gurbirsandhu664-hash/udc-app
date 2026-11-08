import { medicalFacets } from './medical-classification.js';
// General subject analysis and ranked evidence retrieval. Candidate classes are
// independent broad subject suggestions, never invented compound shelf numbers.
const STOP=new Set('a an and or the of for from in on to by with at into using study studies introduction guide handbook book edition volume research applications application impact role analysis methods approach new recent'.split(' '));
const stem=t=>/^[a-z]+$/.test(t)?t.replace(/ies$/,'y').replace(/(ing|es|s)$/,''):t;
export function tokens(text){return [...new Set((String(text).normalize('NFKC').toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu)||[]).filter(t=>t.length>1&&!STOP.has(t)).map(stem))];}
const DOMAINS=[
 ['computing','Computing', '681.3','004',/\b(computers?|computing|software|programming|databases?|artificial intelligence|machine learning|cybersecurity|informatics)\b|ਕੰਪਿਊਟਰ|ਸਾਫਟਵੇਅਰ/i],
 ['education','Education','37','370',/\b(education|educational|teaching|teachers?|schools?|learning|pedagogy|curriculum)\b|ਸਿੱਖਿਆ|ਸਕੂਲ|ਅਧਿਆਪਕ/i],
 ['agriculture','Agriculture','63','630',/\b(agriculture|agricultural|farming|farmers?|crops?|irrigation|harvesting|wheat|maize|barley|rice|horticulture)\b|ਖੇਤੀ|ਕਣਕ|ਮੱਕੀ|ਫਸਲ|ਜੌਂ/i],
 ['biology','Biological sciences','57','570',/\b(biology|biological|genetics|genetic|ecology|ecological|biodiversity|microbiology)\b|ਜੀਵ ਵਿਗਿਆਨ/i],
 ['botany','Botany','58','580',/\b(botany|botanical|plant science|plants?)\b|ਬਨਸਪਤੀ/i],
 ['zoology','Zoology','59','590',/\b(zoology|zoological|animals?|wildlife)\b|ਜਾਨਵਰ/i],
 ['medicine','Medicine','61','610',/\b(medicine|medical|health|healthcare|hospitals?|nursing|surgery|patients?|diseases?|cancer)\b|ਸਿਹਤ|ਮਰੀਜ਼|ਹਸਪਤਾਲ/i],
 ['physics','Physics','53','530',/\b(physics|physical science|quantum|thermodynamics|optics|mechanics)\b|ਭੌਤਿਕ/i],
 ['chemistry','Chemistry','54','540',/\b(chemistry|chemical|chemicals)\b|ਰਸਾਇਣ/i],
 ['mathematics','Mathematics','51','510',/\b(mathematics|mathematical|algebra|geometry|calculus|arithmetic|trigonometry)\b|ਗਣਿਤ/i],
 ['astronomy','Astronomy','52','520',/\b(astronomy|astronomical|astrophysics|galaxies|cosmology)\b|ਖਗੋਲ/i],
 ['earth','Earth sciences','55','550',/\b(geology|geological|earth sciences?|meteorology|climatology|oceanography)\b|ਭੂ ਵਿਗਿਆਨ/i],
 ['engineering','Engineering','62','620',/\b(engineering|engineers?|robotics|mechanical|electrical|technology|technologies)\b|ਇੰਜੀਨੀਅਰ/i],
 ['economics','Economics','33','330',/\b(economics|economic|economy|finance|banking|trade|commerce|markets?)\b|ਅਰਥ|ਬੈਂਕ/i],
 ['law','Law','34','340',/\b(law|laws|legal|legislation|jurisprudence|constitutional)\b|ਕਾਨੂੰਨ/i],
 ['politics','Political science','32','320',/\b(politics|political|elections?|democracy)\b|ਰਾਜਨੀਤੀ/i],
 ['sociology','Sociology','301','301',/\b(sociology|sociological|society|social relations)\b|ਸਮਾਜ ਸ਼ਾਸਤਰ/i],
 ['welfare','Social welfare','36','361',/\b(social welfare|social work|welfare services)\b|ਸਮਾਜ ਭਲਾਈ/i],
 ['psychology','Psychology','159.9','150',/\b(psychology|psychological|cognition|cognitive|mental processes)\b|ਮਨੋਵਿਗਿਆਨ/i],
 ['philosophy','Philosophy','1','100',/\b(philosophy|philosophical|ethics|epistemology)\b|ਦਰਸ਼ਨ/i],
 ['religion','Religion','2','200',/\b(religion|religious|theology|christianity|islam|sikhism|hinduism|buddhism)\b|ਧਰਮ/i],
 ['librarianship','Library science','02','020',/\b(libraries|library|librarianship|librarians?)\b|ਲਾਇਬ੍ਰੇਰੀ/i],
 ['music','Music','78','780',/\b(music|musical|songs?|opera)\b|ਸੰਗੀਤ/i],
 ['architecture','Architecture','72','720',/\b(architecture|architectural)\b|ਵਾਸਤੂ/i],
 ['painting','Painting','75','750',/\b(painting|paintings|painters?)\b|ਚਿੱਤਰਕਾਰੀ/i],
 ['photography','Photography','77','770',/\b(photography|photographic)\b|ਫੋਟੋਗ੍ਰਾਫੀ/i],
 ['literature','Literature','82','800',/\b(literature|literary|novels?|fiction|poetry|poems?|drama)\b|ਸਾਹਿਤ|ਕਵਿਤਾ|ਨਾਵਲ/i],
 ['linguistics','Language and linguistics','80','400',/\b(linguistics|linguistic|grammar|phonetics|languages?|lexicography)\b|ਭਾਸ਼ਾ|ਵਿਆਕਰਨ/i],
 ['history','History','94','900',/\b(history|historical)\b|ਇਤਿਹਾਸ/i],
 ['geography','Geography','91','910',/\b(geography|geographical|cartography|atlases)\b|ਭੂਗੋਲ/i]
];
export function analyseTitle(title,description=''){
 const text=title+' '+description;
 let subjects=DOMAINS.filter(d=>d[4].test(text)).map(([id,label,udc,ddc,re])=>({id,label,udc,ddc,matched_terms:[...new Set((text.match(new RegExp(re.source,'giu'))||[]))]}));
 // Specialist categories absorb their broad parents; genuine intersections remain.
 if(subjects.some(s=>['botany','zoology'].includes(s.id)))subjects=subjects.filter(s=>s.id!=='biology');
 const clinical=medicalFacets(text);
 if(clinical.veterinary&&!clinical.non_clinical&&!clinical.mixed_hosts){
  subjects=subjects.filter(s=>!['medicine','zoology','biology','agriculture'].includes(s.id));
  subjects.unshift({id:'veterinary',label:'Veterinary medicine',udc:'619',ddc:'636.089',matched_terms:[...clinical.species.map(s=>s.label),clinical.condition]});
 }
 if(clinical.condition&&clinical.unknown_hosts.length&&!clinical.non_clinical){
  subjects=subjects.filter(s=>!['medicine','biology','agriculture','zoology'].includes(s.id));
  subjects.unshift({id:'animal_pathology',label:'Comparative animal pathology (broad)',udc:'591.2',ddc:'571.9',matched_terms:[...clinical.unknown_hosts,clinical.condition]});
 }
 const places=[...new Set(text.match(/\b(?:india|punjab|china|japan|united states|usa|europe|africa|britain|france|germany)\b|ਪੰਜਾਬ|ਭਾਰਤ/giu)||[])];
 const periods=[...new Set(text.match(/\b(?:\d{3,4}(?:\s*[-–]\s*\d{2,4})?|\d{1,2}(?:st|nd|rd|th) century|twentieth century|ancient|medieval)\b/gi)||[])];
 const forms=[...new Set(text.match(/\b(?:dictionar(?:y|ies)|bibliograph(?:y|ies)|handbooks?|directories|directory|biograph(?:y|ies)|atlas|atlases|annual reports?|speeches|statistics)\b/gi)||[])];
 const relationships=[...new Set(text.match(/\b(?:influence|impact|effects?|relationship|relations?|applications?|comparison|versus|between|using|repair|maintenance)\b/gi)||[])];
 const questions=[];
 if(!subjects.length)questions.push('Add a short summary, subtitle or contents list so the subject can be identified.');
 if(subjects.length>1)questions.push('Which subject is the main focus of the book? The title spans more than one discipline.');
 if(forms.length)questions.push('Confirm whether the detected form describes the whole book or is only part of its title.');
 return {clinical,subjects,places,periods,forms,relationships,interdisciplinary:subjects.length>1,needs_more_context:subjects.length!==1,questions,description_provided:!!description,
  note:'Detected facets are descriptive. A place, period or form is not automatically appended to a classification number.'};
}
const indexes=new WeakMap();
function getIndex(pages){
 if(indexes.has(pages))return indexes.get(pages);
 const docs=pages.map(page=>{const words=tokens(page.text);return {page,words:new Set(words),length:words.length}}),df=new Map();
 for(const d of docs)for(const t of d.words)df.set(t,(df.get(t)||0)+1);
 const index={docs,df,average:docs.reduce((sum,d)=>sum+d.length,0)/Math.max(1,docs.length)};indexes.set(pages,index);return index;
}
export function searchEvidence(query,pages,limit=5){
 const terms=tokens(query);if(!terms.length||!pages.length)return[];
 const {docs,df,average}=getIndex(pages),N=docs.length;
 return docs.map(d=>{let score=0,hits=0;for(const term of terms){if(!d.words.has(term))continue;hits++;const idf=Math.log(1+(N-(df.get(term)||0)+0.5)/((df.get(term)||0)+0.5));score+=idf/(0.25+0.75*d.length/Math.max(1,average));}
  return {page:d.page.page,volume:d.page.volume||d.page.source||'',score:score*(0.5+hits/terms.length),matched_terms:terms.filter(t=>d.words.has(t)),excerpt:String(d.page.text||'').slice(0,2500)};
 }).filter(d=>d.score>0).sort((a,b)=>b.score-a.score||a.page-b.page).slice(0,limit);
}
export function generalCandidates(analysis,udcPages,ddcPages){
 return analysis.subjects.map(s=>({...s,udc_evidence:searchEvidence(s.matched_terms.join(' ')+' '+s.label,udcPages,2),ddc_evidence:searchEvidence(s.matched_terms.join(' ')+' '+s.label,ddcPages,2),status:'Broad subject candidate; full synthesis is unverified'}));
}
