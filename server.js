const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = Number(process.env.PORT || 10000);
const ROOT = __dirname;
const KEY_FILE = path.join(ROOT, 'udc-2700-key.json');

function norm(s='') {
  return String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[’‘]/g,"'").replace(/[–—−]/g,'-')
    .replace(/[^a-z0-9=:.()\-+\/"& ]+/g,' ')
    .replace(/\s+/g,' ').trim();
}
function compact(s=''){ return norm(s).replace(/[^a-z0-9]/g,''); }
function words(s=''){ return norm(s).split(' ').filter(Boolean); }
function hasWord(t,w){ return new RegExp('(^| )'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'( |$)').test(t); }

let key={entries:[]}, keyError=null;
try {
  key=JSON.parse(fs.readFileSync(KEY_FILE,'utf8'));
  if(!Array.isArray(key.entries) || key.entries.length < 2700) throw new Error('UDC answer key must contain at least 2700 entries');
} catch(e){ keyError=e; }

const CORR_FILE = path.join(ROOT, 'udc-corrections.json');
let corrections = {};
try { if (fs.existsSync(CORR_FILE)) corrections = JSON.parse(fs.readFileSync(CORR_FILE,'utf8')) || {}; } catch(e) { corrections = {}; }

const EXACT=new Map();
if(!keyError) for(const e of key.entries){
  if(!e || !e.title || e.udc==null) continue;
  EXACT.set(norm(e.title),e);
  EXACT.set(compact(e.title),e);
}
for (const [k,e] of Object.entries(corrections)) { if (e && e.title && e.udc) { EXACT.set(norm(k),e); EXACT.set(compact(k),e); } }

const PLACE={
  india:'(540)', pakistan:'(549)', punjab:'(540.15)', china:'(510)', japan:'(520)',
  nepal:'(541.35)', bangladesh:'(549.2)', 'sri lanka':'(548.7)', russia:'(470)',
  usa:'(73)', 'united states':'(73)', 'united kingdom':'(410)', england:'(420)',
  france:'(440)', germany:'(430)', italy:'(450)', spain:'(460)', australia:'(94)',
  canada:'(71)', asia:'(5)', 'south asia':'(5-13)', europe:'(4)', africa:'(6)', world:'(100)'
};
const LANG={
  english:['811.111','821.111'], hindi:['811.214.21','821.214.21'], punjabi:['811.214.22','821.214.22'],
  urdu:['811.214.31','821.214.31'], bengali:['811.214.32','821.214.32'], marathi:['811.214.34','821.214.34'],
  gujarati:['811.214.35','821.214.35'], tamil:['811.214.42','821.214.42'], telugu:['811.214.43','821.214.43'],
  kannada:['811.214.44','821.214.44'], malayalam:['811.214.45','821.214.45'], sanskrit:['811.211','821.211'],
  french:['811.133.1','821.133.1'], german:['811.112.2','821.112.2'], spanish:['811.134.2','821.134.2'],
  arabic:['811.411','821.411'], persian:['811.411.1','821.411.1'], chinese:['811.581','821.581'], japanese:['811.521','821.521']
};
const FORM={dictionary:'(038)',dictionaries:'(038)',encyclopedia:'(031)',encyclopaedia:'(031)',handbook:'(035)',manual:'(035)',textbook:'(075)',atlas:'(084)',guide:'(036)',bibliography:'(01)',catalogue:'(083)',catalog:'(083)',thesis:'(043)',dissertation:'(043)',report:'(047)',directory:'(058)',yearbook:'(058)'};

function detectOne(t,obj){
  for(const k of Object.keys(obj).sort((a,b)=>b.length-a.length)) if(t.includes(k)) return [k,obj[k]];
  return null;
}
function placeHits(t){
  const out=[]; for(const k of Object.keys(PLACE)){ const i=t.indexOf(k); if(i>=0 && !out.some(x=>x[1]===PLACE[k])) out.push([k,PLACE[k],i]); } out.sort((a,b)=>a[2]-b[2]); return out;
}
function make(title,udc,subject,subSubject='',confidence='Medium',explanation='',source='rule'){
  return {ok:true,title,bookTitle:title,finalUdcNumber:String(udc),udc:String(udc),mainSubject:subject,subSubject,confidence,verifiedRule:source==='answer-key'||confidence==='High',source,explanation:explanation||`${udc} = ${subject}.`};
}

function answerKey(t){
  const e=EXACT.get(t)||EXACT.get(compact(t));
  if(e) return makeFromEntry(t,e,'answer-key');
  // tolerate common punctuation/case/"the" differences via exact token normalization
  const noThe=t.replace(/(^| )the /g,' ').replace(/  +/g,' ').trim();
  const e2=EXACT.get(noThe)||EXACT.get(compact(noThe));
  return e2?makeFromEntry(t,e2,'answer-key'):null;
}
function makeFromEntry(title,e,source){return make(title,e.udc,e.subject||'',e.subSubject||'',e.confidence||'High',e.explanation||`${e.udc} = ${e.subject||''}.`,source);}

function classify(raw){
  const title=String(raw||'').trim(); if(!title) return make(title,'0','No title','Enter a book title','Low','Please enter a title.','empty');
  const t=norm(title);
  if(keyError) return make(title,'—','UDC key unavailable','Server configuration error','Low',keyError.message,'error');

  const exact=answerKey(t); if(exact) return exact;

  // High-priority semantic constructions. These run before broad keywords.
  if((hasWord(t,'science')||hasWord(t,'scientific')) && hasWord(t,'arts'))
    return make(title,'5+7','Science and arts','Equal coordination of science and arts','High','5 = mathematics and natural sciences; 7 = arts; + connects equally important subjects.','rule');
  if(hasWord(t,'science') && hasWord(t,'technology'))
    return make(title,'5/6','Science and technology','Mathematics/natural sciences and applied sciences/technology','High','5 = mathematics and natural sciences; 6 = applied sciences, medicine and technology; / links consecutive classes.','rule');

  // Medical terms before the generic word "art" etc. Heart disease is never class 7.
  if(hasWord(t,'heart') || hasWord(t,'cardiac') || hasWord(t,'coronary') || hasWord(t,'cardiovascular'))
    return make(title,'616.12','Medicine — cardiovascular diseases','Diseases of the heart/cardiovascular system','High','616.12 is used here for diseases of the heart/cardiovascular system. Medical context takes priority over unrelated substring matches.','rule');
  if(hasWord(t,'stroke') || hasWord(t,'cerebrovascular'))
    return make(title,'616.831','Medicine — diseases of the nervous system','Stroke / cerebrovascular disease','High','616.831 is the rule used for stroke/cerebrovascular disease.','rule');

  // International relations and colon relation between named countries.
  const ir=/\b(international relations?|foreign relations?|foreign policy|diplomatic relations?|diplomacy|geopolitics|international affairs?)\b/.test(t);
  if(ir){
    const ph=placeHits(t);
    if(ph.length>=2) return make(title,`327(${ph[0][1].slice(1,-1)}:${ph[1][1].slice(1,-1)})`,'International relations','Relations between '+ph[0][0]+' and '+ph[1][0],'High','327 = international relations; : expresses a simple relation between the two place auxiliaries.','rule');
    if(ph.length===1) return make(title,'327'+ph[0][1],'International relations','Foreign/international relations of '+ph[0][0],'High','327 = international relations; the named country is represented by a place auxiliary.','rule');
    return make(title,'327','International relations','International relations','High','327 = international relations, diplomacy and foreign policy.','rule');
  }

  // Literature/language: identify the language first, then literary form.
  const lang=detectOne(t,LANG);
  const lit=/\b(literature|literary|poetry|poem|drama|play|plays|fiction|novel|novels|essay|essays)\b/.test(t);
  const ling=/\b(language|linguistics|linguistic|grammar|phonetics|syntax|semantics|morphology)\b/.test(t);
  if(lang && lit){
    let u=lang[1][1];
    if(/\b(poetry|poem)\b/.test(t)) u+='-1'; else if(/\b(drama|play|plays)\b/.test(t)) u+='-2'; else if(/\b(fiction|novel|novels)\b/.test(t)) u+='-3'; else if(/\b(essay|essays)\b/.test(t)) u+='-4';
    return make(title,u,lang[0]+' literature','Literary form: '+(u.endsWith('-1')?'poetry':u.endsWith('-2')?'drama':u.endsWith('-3')?'fiction':u.endsWith('-4')?'essay':'literature'),'High','The language is encoded in the 821.x literature number; the literary form is added with -1/-2/-3/-4 where applicable.','rule');
  }
  if(lang && ling) return make(title,lang[1][0],lang[0]+' language','Language / linguistics','High',`${lang[1][0]} = ${lang[0]} language in this classifier. The language code is built into the 811.x number.`, 'rule');

  // Forms should modify the subject, not override a clear subject.
  const form=detectOne(t,FORM);

  const subjectRules=[
    [/\blinear algebra\b/,'512.64','Mathematics — linear algebra','Linear algebra'],
    [/\bnumber theory\b/,'511','Mathematics — number theory','Number theory'],
    [/\bprobability\b/,'519.2','Mathematics — probability','Probability'],
    [/\bcombinatorics\b/,'519.1','Mathematics — combinatorics','Combinatorial analysis; graph theory'],
    [/\btopology\b/,'515.1','Mathematics — topology','Topology'],
    [/\bcalculus\b/,'517','Mathematics — analysis','Calculus / mathematical analysis'],
    [/\balgebra\b/,'512','Mathematics — algebra','Algebra'],
    [/\bgeometry\b/,'514','Mathematics — geometry','Geometry'],
  ];
  for(const [re,u,s,sub] of subjectRules){ if(re.test(t)){
    let udc=u, explanation=`${u} = ${sub}.`;
    if(/\bhistory\b/.test(t)) {udc+='(091)'; explanation+=` (091) = historical presentation.`;}
    else if(/\bteaching\b|\beducation\b/.test(t)) {udc+=':37'; explanation+=` :37 expresses relation to education/teaching.`;}
    const ph=placeHits(t); if(ph.length===1){udc+=ph[0][1]; explanation+=` ${ph[0][1]} = ${ph[0][0]} place auxiliary.`;}
    const fm=detectOne(t,FORM); if(fm){udc+=fm[1]; explanation+=` ${fm[1]} = ${fm[0]} form auxiliary.`;}
    return make(title,udc,s,sub,'High',explanation,'rule');
  }}

  const rules=[
    [/\b(library classification|classification of books|cataloguing|cataloging)\b/,'025.42','Library and information science — classification','Library classification'],
    [/\b(library science|librarianship|libraries)\b/,'02','Library and information science','Library science / librarianship'],
    [/\b(computer programming|programming)\b/,'004.42','Computer science','Computer programming'],
    [/\b(artificial intelligence|machine learning)\b/,'004.8','Computer science','Artificial intelligence / machine learning'],
    [/\b(computer science|information technology|computing|software)\b/,'004','Computer science','Computing and information technology'],
    [/\b(mathematics|algebra|geometry|calculus|statistics)\b/,'51','Mathematics','Mathematics'],
    [/\b(astronomy)\b/,'52','Astronomy','Astronomy'],[/\b(physics|quantum|optics|thermodynamics)\b/,'53','Physics','Physics'],
    [/\b(chemistry|chemical)\b/,'54','Chemistry','Chemistry'],[/\b(geology)\b/,'55','Earth sciences','Geology'],
    [/\b(biology|microbiology|genetics)\b/,'57','Biological sciences','Biology'],[/\b(botany)\b/,'58','Botany','Botany'],[/\b(zoology)\b/,'59','Zoology','Zoology'],
    [/\b(medicine|medical|health|hospital|nursing|surgery|anatomy|physiology)\b/,'61','Medicine','Medical science / health'],
    [/\b(mechanical engineering)\b/,'621','Engineering and technology','Mechanical engineering'],[/\b(electrical engineering)\b/,'621.3','Engineering and technology','Electrical engineering'],
    [/\b(civil engineering)\b/,'624','Engineering and technology','Civil engineering'],[/\b(engineering|technology)\b/,'62','Engineering and technology','Engineering / technology'],
    [/\b(agriculture|farming)\b/,'63','Agriculture','Agriculture / farming'],[/\b(horticulture)\b/,'635','Agriculture','Horticulture'],[/\b(forestry)\b/,'630','Agriculture','Forestry'],
    [/\b(management|business management)\b/,'65','Management','Business administration / management'],[/\b(marketing)\b/,'658.8','Management','Marketing'],[/\b(accounting)\b/,'657','Management','Accounting'],
    [/\b(political science|politics|government)\b/,'32','Social sciences — political science','Politics / government'],[/\b(democracy)\b/,'321','Social sciences — political science','Democracy'],
    [/\b(elections?|electoral)\b/,'324','Social sciences — political science','Elections'],[/\b(parliament)\b/,'328','Social sciences — political science','Parliament'],
    [/\b(public administration)\b/,'35','Social sciences — public administration','Public administration'],[/\b(sociology|society)\b/,'316','Social sciences — sociology','Sociology / society'],
    [/\b(anthropology|ethnography)\b/,'39','Social sciences — ethnography','Anthropology / ethnography'],[/\b(demography|population)\b/,'314','Social sciences — demography','Demography / population'],
    [/\b(international law)\b/,'341','Law','International law'],[/\b(criminal law)\b/,'343','Law','Criminal law'],[/\b(civil law)\b/,'347','Law','Civil law'],[/\b(human rights|constitutional law)\b/,'342','Law','Constitutional law / human rights'],[/\b(law|jurisprudence)\b/,'34','Law','Law / jurisprudence'],
    [/\b(international trade)\b/,'339.5','Economics','International trade'],[/\b(trade)\b/,'339','Economics','Trade'],[/\b(economics|economy)\b/,'33','Economics','Economics / economy'],
    [/\b(education|teaching|pedagogy)\b/,'37','Education','Education / teaching'],[/\b(higher education)\b/,'378','Education','Higher education'],
    [/\b(philosophy)\b/,'1','Philosophy','Philosophy'],[/\b(ethics)\b/,'17','Philosophy','Ethics'],[/\b(logic)\b/,'16','Philosophy','Logic'],[/\b(psychology)\b/,'159.9','Psychology','Psychology'],
    [/\b(religion|theology|sikhism|hinduism|islam|christianity|buddhism|jainism)\b/,'2','Religion and theology','Religion / theology'],
    [/\b(painting)\b/,'75','The arts','Painting'],[/\b(sculpture)\b/,'73','The arts','Sculpture'],[/\b(music)\b/,'78','The arts','Music'],[/\b(dance)\b/,'793.3','The arts','Dance'],[/\b(cinema|film)\b/,'791','The arts','Cinema / film'],[/\b(theatre|theater)\b/,'792','The arts','Theatre'],
    [/\b(sport|sports|cricket|football|hockey|tennis)\b/,'796','The arts — sport','Sport'],
    [/\b(journalism|newspaper|media)\b/,'070','Journalism and mass media','Journalism / media'],[/\b(tourism|hospitality)\b/,'338.48','Economics','Tourism'],
    [/\b(biography|autobiography|memoir)\b/,'92','History and biography','Biography / autobiography'],
    [/\b(history|historical)\b/,'94','History','General history'],[/\b(geography|geographical)\b/,'91','Geography','Geography'],
    [/\b(arts?|fine arts)\b/,'7','The arts','Arts'],
  ];
  for(const [re,u,s,sub] of rules){ if(re.test(t)){
    let udc=u, explanation=`${u} = ${sub}.`;
    const ph=placeHits(t);
    if(ph.length===1 && ['94','91','32','33','34','35','37','39','1','2','3','316','39','7','78','791','792','796','339'].includes(u)) { udc+=ph[0][1]; explanation+=` ${ph[0][1]} = ${ph[0][0]} place auxiliary.`; }
    if(form && !/\b(library classification|classification of books)\b/.test(t)) { udc+=form[1]; explanation+=` ${form[1]} = ${form[0]} form auxiliary.`; }
    return make(title,udc,s,sub,'Medium',explanation,'rule');
  }}

  // Non-zero intelligent fallback: infer from the strongest meaningful word.
  const fallback=[
    ['science','5','Mathematics and natural sciences'],['technology','62','Engineering and technology'],['medicine','61','Medicine'],['health','61','Medicine'],['education','37','Education'],['history','94','History'],['geography','91','Geography'],['art','7','The arts'],['arts','7','The arts'],['language','81','Language'],['literature','82','Literature'],['business','65','Management'],['law','34','Law'],['religion','2','Religion'],['politics','32','Political science'],['economics','33','Economics'],['trade','339','Trade'],['computer','004','Computer science'],['engineering','62','Engineering and technology'],['agriculture','63','Agriculture']
  ];
  for(const [w,u,s] of fallback) if(hasWord(t,w)) return make(title,u,s,'General subject match','Low',`The title contains the subject indicator “${w}”; a broader UDC class is supplied rather than returning 0. Verify the detailed schedule for a more specific number.`,'fallback');
  return make(title,'0','General works','No specific subject indicator detected','Low','No sufficiently specific subject indicator was detected. 0 is used only as a genuine UDC general-works fallback; no fabricated specific number is claimed.','fallback');
}

function assistantAnswer(question,title,udc){
  const t=String(title||'').trim(); const q=norm(question||'');
  if(!t) return 'Please enter a book title first. I can then explain the current UDC classification and help you review it.';
  const r=classify(t);
  if(/\b(save|add|correct|wrong|change)\b/.test(q) && /\b(key|answer|udc)\b/.test(q)) return `I can help review it, but a correction should only be saved when the UDC number is verified from your UDC source. Current result for “${t}” is ${r.udc}. Enter the verified number in the correction field and use SAVE CORRECTION TO KEY.`;
  if(/\bwhy\b|explain|correct|reason|how/.test(q)) return `For “${t}”, the current result is ${r.udc} — ${r.mainSubject||'UDC subject'}. ${r.explanation||''} Source: ${r.source||'rule'}. If your UDC schedule gives a different number, tell me that verified number and it can be saved as a title-specific correction.`;
  if(/\b(number|class|classification|udc)\b/.test(q)) return `The current classification for “${t}” is ${r.udc} — ${r.mainSubject||'UDC subject'} (${r.confidence||'Medium'} confidence). ${r.explanation||''}`;
  return `I’m ready to discuss “${t}”. Current UDC: ${r.udc} — ${r.mainSubject||'UDC subject'}. Ask “why?” for the notation explanation, or provide a verified UDC number if you want to review/correct the key.`;
}

function json(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(obj));}
function send(res,status,type,data){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(data);}
function readBody(req){return new Promise((resolve,reject)=>{let d='';req.on('data',c=>{d+=c;if(d.length>1024*1024) reject(new Error('Request too large'));});req.on('end',()=>resolve(d));req.on('error',reject);});}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET' && (url.pathname==='/health'||url.pathname==='/api/health')) return json(res,200,{ok:!keyError,service:'UDC Ultimate Classifier',version:'V16.1-2700-ASSISTANT-REVIEW',keyLoaded:!keyError,titleCount:key.entries?.length||0});
    if(req.method==='GET' && url.pathname==='/api/key-info') return json(res,200,{ok:!keyError,titleCount:key.entries?.length||0,version:key.version||'unknown',edition:key.edition_note||'UDC practice key'});
    if(req.method==='GET' && url.pathname==='/api/corrections') return json(res,200,{ok:true,count:Object.keys(corrections).length,corrections:Object.values(corrections)});
    if(req.method==='POST' && url.pathname==='/api/corrections'){
      const body=await readBody(req); let p={}; try{p=JSON.parse(body||'{}')}catch{}
      const title=String(p.title||'').trim(), udc=String(p.udc||'').trim();
      if(!title || !udc) return json(res,400,{ok:false,error:'Title and UDC number are required'});
      const item={title,udc,subject:String(p.subject||'UDC subject'),subSubject:String(p.subSubject||''),confidence:'High',explanation:String(p.explanation||'Manually verified correction.'),source:'user-correction',verifiedRule:true};
      corrections[norm(title)]=item;
      try { fs.writeFileSync(CORR_FILE, JSON.stringify(corrections,null,2)); } catch(e) { return json(res,500,{ok:false,error:'Could not save correction: '+e.message}); }
      EXACT.set(norm(title),item); EXACT.set(compact(title),item);
      return json(res,200,{ok:true,item,count:Object.keys(corrections).length,note:'Saved to local correction store. On Render free instances, filesystem changes may not survive a restart/redeploy.'});
    }
    if(req.method==='POST' && url.pathname==='/api/assistant'){
      const body=await readBody(req); let p={}; try{p=JSON.parse(body||'{}')}catch{}
      return json(res,200,{ok:true,answer:assistantAnswer(p.question||'',p.title||p.bookTitle||'',p.udc||'')});
    }
    if(req.method==='POST' && (url.pathname==='/api/classify'||url.pathname==='/classify')){
      const body=await readBody(req); let p={}; try{p=JSON.parse(body||'{}')}catch{}
      return json(res,200,classify(p.title||p.bookTitle||p.query||''));
    }
    if(req.method==='GET' && (url.pathname==='/'||url.pathname==='/index.html')) return send(res,200,'text/html; charset=utf-8',fs.readFileSync(path.join(ROOT,'index.html')));
    return send(res,404,'text/plain; charset=utf-8','Not found');
  }catch(e){console.error(e);json(res,500,{ok:false,error:e.message});}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`UDC V16.1-2700-ASSISTANT-REVIEW listening on ${PORT} | key=${key.entries?.length||0}`));
