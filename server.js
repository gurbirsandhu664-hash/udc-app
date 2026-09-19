const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({limit:'1mb'}));
app.use(express.static(__dirname));

function norm(s){
  return String(s||'')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’']/g,"'")
    .replace(/[^a-z0-9=:.()\-+\/" ]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
const has=(t,p)=>t.includes(p);

function result(title, r, confidence='High'){
  return {
    title,
    bookTitle:title,
    udc:r.udc,
    finalUdcNumber:r.udc,
    proposedUdcNumber:r.udc,
    mainClass:r.mainClass || String(r.udc||'').split(/[.(=\"\-+/:]/)[0],
    subject:r.subject||'',
    mainSubject:r.subject||'',
    subSubject:r.subSubject||'',
    confidence:r.confidence||confidence,
    explanation:r.explanation||`UDC ${r.udc}: ${r.subject||''}.`,
    cataloguerExplanation:r.cataloguerExplanation||r.explanation||`UDC ${r.udc}: ${r.subject||''}.`,
    alternatives:r.alternatives||[],
    aux:r.aux||[],
    verifiedRule:r.verifiedRule!==false,
    source:r.source||'local UDC rule set'
  };
}

const exact = new Map([
  ['history of india',['94(540)','History of India','94 History + (540) India','94 = General history; (540) = India.']],
  ['indian history',['94(540)','Indian History','94 History + (540) India','94 = General history; (540) = India.']],
  ['geography of india',['91(540)','Geography of India','91 Geography + (540) India','91 = Geography; (540) = India.']],
  ['indian constitution',['342(540)','Indian Constitution','342 Constitutional law + (540) India','342 = Constitutional law; (540) = India.']],
  ['economy of india',['330(540)','Economy of India','330 Economics + (540) India','330 = Economics; (540) = India.']],
  ['history of punjab',['94(540.15)','History of Punjab','94 History + (540.15) Punjab','94 = General history; (540.15) = Punjab.']],
  ['sikh history',['94(540.15)','Sikh History','94 History + (540.15) Punjab','94 = General history; (540.15) = Punjab.']],
  ['indian literature',['821.21(540)','Indian Literature','821.21 Indic literature + (540) India','821.21 = Indic literature; (540) = India.']],
  ['indian philosophy',['1(540)','Indian Philosophy','1 Philosophy + (540) India','1 = Philosophy; (540) = India.']],
  ['indian art',['7(540)','Indian Art','7 Arts + (540) India','7 = The Arts; (540) = India.']],
  ['science and arts',['5+7','Science and Arts','5 Mathematics and Natural Sciences + 7 The Arts','5 = Mathematics and Natural Sciences; + = coordination; 7 = The Arts.']],
  ['science arts',['5+7','Science and Arts','5 Mathematics and Natural Sciences + 7 The Arts','5 = Mathematics and Natural Sciences; + = coordination; 7 = The Arts.']],
  ['science + arts',['5+7','Science and Arts','5 Mathematics and Natural Sciences + 7 The Arts','5 = Mathematics and Natural Sciences; + = coordination; 7 = The Arts.']],
  ['science and technology',['5+6','Science and Technology','5 Mathematics and Natural Sciences + 6 Applied Sciences, Medicine and Technology','5 = Mathematics and Natural Sciences; + = coordination; 6 = Applied Sciences, Medicine and Technology.']],
  ['arts and humanities',['7+9','Arts and Humanities','7 The Arts + 9 Geography, Biography and History','7 = The Arts; + = coordination; 9 = Geography, Biography and History.']]
]);

const subjects = [
  [/computer science|computing|programming|software|hardware|internet|database|cyber|artificial intelligence|machine learning/,'004','Computer Science'],
  [/mathematics|math|algebra|geometry|calculus|statistics/,'51','Mathematics'],
  [/physics/,'53','Physics'],
  [/chemistry|chemical/,'54','Chemistry'],
  [/biology|botany|zoology|ecology/,'57','Biological Sciences'],
  [/medicine|medical|health|nursing|surgery|pharmacology|anatomy|physiology/,'61','Medicine / Medical Sciences'],
  [/agriculture|farming|crop|horticulture|forestry|fisher/,'63','Agriculture'],
  [/engineering|technology|mechanical|electrical|electronics|construction/,'62','Engineering / Technology'],
  [/architecture/,'72','Architecture'],
  [/library|librarian|catalog|classification/,'02','Library Science'],
  [/journalism|newspaper/,'070','Journalism'],
  [/media|mass communication|communication/,'316.77','Mass Communication / Media'],
  [/music/,'78','Music'],
  [/cinema|film|movie|motion picture/,'791','Cinema / Motion Pictures'],
  [/theatre|theater/,'792','Theatre'],
  [/sport|cricket|football|hockey|olympic/,'796','Sports'],
  [/law|legal|jurisprudence|criminal law|civil law/,'34','Law'],
  [/constitution|constitutional/,'342','Constitutional Law'],
  [/politic|government|democracy|election|parliament/,'32','Politics / Political Science'],
  [/econom|finance|banking|trade|commerce/,'33','Economics'],
  [/business|management|marketing|entrepreneurship/,'65','Business / Management'],
  [/education|teaching|pedagogy|curriculum|school|university/,'37','Education'],
  [/psycholog|psychoanalysis/,'159.9','Psychology'],
  [/philosoph|ethics|logic|metaphysics/,'1','Philosophy'],
  [/religion|religious|theology|sikhism|islam|hindu|christian|buddh|jain/,'2','Religion / Theology'],
  [/history|historical|heritage/,'94','General History'],
  [/geograph|atlas/,'91','Geography'],
  [/biography|autobiography|memoir/,'92','Biography']
];

const languages = [
  [/english/,'English','811.111','821.111'],
  [/hindi/,'Hindi','811.214.21','821.214.21'],
  [/punjabi/,'Punjabi','811.214.22','821.214.22'],
  [/urdu/,'Urdu','811.214.31','821.214.31'],
  [/bengali/,'Bengali','811.214.32','821.214.32'],
  [/tamil/,'Tamil','811.214.42','821.214.42'],
  [/sanskrit/,'Sanskrit','811.211','821.211']
];

function classify(raw){
  const title=String(raw||'').trim(), t=norm(title);
  if(!t) return result('',{udc:'0',subject:'Science and knowledge',subSubject:'General works',explanation:'0 = Science and knowledge.'},'Low');

  // Compound subjects MUST be checked before single-subject matches.
  if(/^(science\s*(and|\+)\s*arts|science\s+arts)$/.test(t))
    return result(title,{udc:'5+7',mainClass:'5+7',subject:'Science and Arts',subSubject:'Mathematics and Natural Sciences + The Arts',
      aux:[{type:'subject',code:'5',name:'Mathematics and Natural Sciences'},{type:'coordination',code:'+',name:'Coordination'},{type:'subject',code:'7',name:'The Arts'}],
      explanation:'5 = Mathematics and Natural Sciences; + = coordination of equally important subjects; 7 = The Arts.'});

  if(/^(science\s*(and|\+)\s*technology|science\s+technology)$/.test(t))
    return result(title,{udc:'5+6',mainClass:'5+6',subject:'Science and Technology',subSubject:'Mathematics and Natural Sciences + Applied Sciences, Medicine and Technology',
      aux:[{type:'subject',code:'5',name:'Mathematics and Natural Sciences'},{type:'coordination',code:'+',name:'Coordination'},{type:'subject',code:'6',name:'Applied Sciences, Medicine and Technology'}],
      explanation:'5 = Mathematics and Natural Sciences; + = coordination; 6 = Applied Sciences, Medicine and Technology.'});

  if(/^(arts\s*(and|\+)\s*humanities|arts\s+humanities)$/.test(t))
    return result(title,{udc:'7+9',mainClass:'7+9',subject:'Arts and Humanities',subSubject:'The Arts + Geography, Biography and History',
      aux:[{type:'subject',code:'7',name:'The Arts'},{type:'coordination',code:'+',name:'Coordination'},{type:'subject',code:'9',name:'Geography, Biography and History'}],
      explanation:'7 = The Arts; + = coordination; 9 = Geography, Biography and History.'});

  if(exact.has(t)){
    const [udc,subject,breakdown,explanation]=exact.get(t);
    return result(title,{udc,mainClass:udc,subject,subSubject:subject,breakdown,explanation});
  }

  // Literature/language rules before generic keyword rules.
  for(const [re,name,langClass,litClass] of languages){
    if(!re.test(t)) continue;
    if(has(t,'dictionary')||has(t,'lexicon')||has(t,'glossary'))
      return result(title,{udc:`${langClass}(038)`,mainClass:'81',subject:`${name} language — dictionary / lexicon`,subSubject:'Dictionary',
        aux:[{type:'language',code:langClass,name},{type:'form',code:'(038)',name:'Dictionary'}],
        explanation:`${langClass} = ${name} language; (038) = dictionary/form auxiliary.`},'Medium');
    if(has(t,'drama')||has(t,'play'))
      return result(title,{udc:`${litClass}-2`,mainClass:'821',subject:`${name} literature — drama`,subSubject:'Drama',
        aux:[{type:'language',code:litClass,name},{type:'literary-form',code:'-2',name:'Drama'}],
        explanation:`${litClass} = ${name} literature; -2 = drama literary form.`});
    if(has(t,'poetry')||has(t,'poem'))
      return result(title,{udc:`${litClass}-1`,mainClass:'821',subject:`${name} literature — poetry`,subSubject:'Poetry',
        aux:[{type:'language',code:litClass,name},{type:'literary-form',code:'-1',name:'Poetry'}],
        explanation:`${litClass} = ${name} literature; -1 = poetry literary form.`});
    if(has(t,'fiction')||has(t,'novel')||has(t,'short story')||has(t,'short stories'))
      return result(title,{udc:`${litClass}-3`,mainClass:'821',subject:`${name} literature — fiction`,subSubject:'Fiction',
        aux:[{type:'language',code:litClass,name},{type:'literary-form',code:'-3',name:'Fiction'}],
        explanation:`${litClass} = ${name} literature; -3 = fiction literary form.`});
    if(has(t,'literature'))
      return result(title,{udc:litClass,mainClass:'821',subject:`${name} Literature`,subSubject:'Literature',
        aux:[{type:'language',code:litClass,name}],explanation:`${litClass} = literature in ${name}.`});
    if(has(t,'grammar'))
      return result(title,{udc:langClass,mainClass:'811',subject:`${name} language — grammar`,subSubject:'Grammar',
        aux:[{type:'language',code:langClass,name}],explanation:`${langClass} = ${name} language; grammar subdivision should be checked against the licensed UDC schedule.`},'Medium');
  }

  // Form auxiliaries are added after the subject.
  let matched=null;
  for(const item of subjects){ if(item[0].test(t)){matched=item;break;} }
  if(matched){
    let [re,udc,subject]=matched;
    const aux=[]; let final=udc; let explanation=`${udc} = ${subject}.`;
    if(has(t,'dictionary')||has(t,'lexicon')||has(t,'glossary')){
      final+='(038)'; aux.push({type:'form',code:'(038)',name:'Dictionary'});
      explanation+=' (038) = dictionary/form auxiliary.';
    } else if(has(t,'encyclopedia')||has(t,'encyclopaedia')){
      final+='(03)'; aux.push({type:'form',code:'(03)',name:'Encyclopaedia / reference work'});
      explanation+=' (03) = encyclopaedia/reference work form.';
    } else if(has(t,'handbook')||has(t,'manual')){
      final+='(035)'; aux.push({type:'form',code:'(035)',name:'Handbook / manual'});
      explanation+=' (035) = handbook/manual form.';
    } else if(has(t,'textbook')){
      final+='(075)'; aux.push({type:'form',code:'(075)',name:'Textbook'});
      explanation+=' (075) = textbook form.';
    }
    return result(title,{udc:final,mainClass:udc,subject,subSubject:subject,aux,explanation});
  }

  return result(title,{udc:'0',mainClass:'0',subject:'Science and knowledge',subSubject:'General / interdisciplinary',
    explanation:'No sufficiently specific local rule matched this title. Use the authoritative/licensed UDC schedule for exact cataloguing.'},'Low');
}

app.get('/health',(req,res)=>res.json({ok:true,service:'UDC Classifier',version:'final-fixed-2026-09-19'}));
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.post('/api/classify',(req,res)=>{try{return res.json(classify(req.body?.title??req.body?.bookTitle??req.body?.query??''));}catch(e){return res.status(500).json({error:'Classification failed',message:e.message});}});
app.post('/classify',(req,res)=>{try{return res.json(classify(req.body?.title??req.body?.bookTitle??req.body?.query??''));}catch(e){return res.status(500).json({error:'Classification failed',message:e.message});}});

const PORT=process.env.PORT||10000;
app.listen(PORT,()=>console.log(`UDC classifier listening on ${PORT}`));
