const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({limit:'1mb'}));
app.use(express.static(__dirname));

const rules = JSON.parse(fs.readFileSync(path.join(__dirname,'udc-rules.json'),'utf8'));

function norm(s){
  return String(s||'').toLowerCase().normalize('NFKD')
    .replace(/[’']/g,"'").replace(/[^a-z0-9=:.()\-+/ ]+/g,' ')
    .replace(/\s+/g,' ').trim();
}
function has(t,p){ return t.includes(p); }
function match(t, arr){ return (arr||[]).find(x => x.patterns.some(p=>has(t,p))); }

function make(title, x, confidence='High'){
  return {
    title, bookTitle:title,
    udc:x.udc, finalUdcNumber:x.udc, proposedUdcNumber:x.udc,
    mainClass:x.mainClass || x.udc,
    subject:x.subject, mainSubject:x.subject,
    subSubject:x.subSubject||'',
    confidence,
    explanation:x.explanation,
    cataloguerExplanation:x.explanation,
    notationBreakdown:x.breakdown||x.explanation,
    aux:x.aux||[],
    alternatives:x.alternatives||[],
    verifiedRule:x.verifiedRule!==false,
    source:'UDC Summary-oriented local rule set'
  };
}

function classify(raw){
  const title=String(raw||'').trim(), t=norm(title);
  if(!t) return make('',{udc:'',mainClass:'',subject:'',explanation:'Enter a book title.'},'Low');

  // Exact high-priority rules. These must run before broad word rules.
  const exact=(rules.exact||[]).find(x=>norm(x.title)===t);
  if(exact) return make(title,exact);

  // Explicit coordinated/extended subjects.
  if(/\bscience\s+and\s+arts\b/.test(t)){
    return make(title,{
      udc:'5+7',mainClass:'5+7',subject:'Science and Arts',
      subSubject:'Mathematics and natural sciences + Arts',
      aux:[{type:'symbol',code:'+',name:'Coordination'}],
      breakdown:'5 = Mathematics and natural sciences; + = coordination of equally important subjects; 7 = Arts.',
      explanation:'5 = Mathematics and natural sciences; + = coordination of equally important subjects; 7 = Arts.',
      verifiedRule:true
    });
  }
  if(/\bscience\s+and\s+technology\b/.test(t) || /\bscience\s*&\s*technology\b/.test(t)){
    return make(title,{
      udc:'5/6',mainClass:'5/6',subject:'Mathematics and natural sciences — Applied sciences, medicine and technology',
      subSubject:'Science and technology',
      aux:[{type:'symbol',code:'/',name:'Extension'}],
      breakdown:'5 = Mathematics and natural sciences; / = extension of a notation; 6 = Applied sciences, medicine and technology.',
      explanation:'5 = Mathematics and natural sciences; / = extension from class 5 to class 6, covering the combined range of science and technology.',
      verifiedRule:true
    });
  }

  // Country-to-country relations.
  const found=(rules.countries||[]).filter(c=>c.patterns.some(p=>has(t,p)));
  const relationWords=['relation','relations','relationship','relationships','diplomatic','diplomacy','bilateral','foreign policy','foreign affairs','cooperation','conflict','ties'];
  if(found.length>=2 && relationWords.some(w=>has(t,w))){
    const a=found[0], b=found[1];
    return make(title,{
      udc:`327(${a.code}:${b.code})`,mainClass:'327',
      subject:`International relations between ${a.name} and ${b.name}`,
      subSubject:'Foreign / international relations',
      aux:[{type:'place',code:a.code,name:a.name},{type:'symbol',code:':',name:'Relation'},{type:'place',code:b.code,name:b.name}],
      breakdown:`327 = international relations; (${a.code}:${b.code}) = relation between ${a.name} and ${b.name}; : expresses relation.`,
      explanation:`327 = international relations; ${a.code} = ${a.name}; : = relation; ${b.code} = ${b.name}.`,
      verifiedRule:true
    });
  }

  // Language/literature.
  const lang=match(t,rules.languages);
  if(lang){
    if(has(t,'literature')||has(t,'poetry')||has(t,'poem')||has(t,'drama')||has(t,'play')||has(t,'novel')||has(t,'fiction')||has(t,'short story')||has(t,'short stories')){
      let suffix='';
      let form='Literature';
      if(has(t,'drama')||has(t,'play')){suffix='-2';form='Drama';}
      else if(has(t,'poetry')||has(t,'poem')){suffix='-1';form='Poetry';}
      else if(has(t,'novel')||has(t,'fiction')||has(t,'short story')||has(t,'short stories')){suffix='-3';form='Fiction';}
      const code=lang.litCode||lang.code;
      return make(title,{udc:`${code}${suffix}`,mainClass:'821',subject:`${lang.name} literature — ${form}`,subSubject:form,
        aux:[{type:'language',code:lang.aux,name:lang.name}],
        breakdown:`${code} = literature in ${lang.name}; ${suffix||'general'} = literary form.`,
        explanation:`${code} = literature in ${lang.name}; the literary-form subdivision identifies ${form.toLowerCase()}.`,
        verifiedRule:true});
    }
    if(has(t,'dictionary')||has(t,'lexicon')||has(t,'glossary')){
      return make(title,{udc:`${lang.litCode||lang.code}(038)`,mainClass:'8',subject:`${lang.name} language — dictionary`,subSubject:'Dictionary',
        aux:[{type:'language',code:lang.aux,name:lang.name},{type:'form',code:'(038)',name:'Dictionary'}],
        breakdown:`Language/literature notation for ${lang.name} + (038) dictionary form.`,
        explanation:`${lang.name} language/literature notation combined with (038), the form auxiliary for dictionaries.`,
        verifiedRule:true});
    }
    if(has(t,'grammar')||has(t,'linguistics')||has(t,'language')||has(t,'phonetics')||has(t,'phonology')){
      return make(title,{udc:lang.languageClass,mainClass:'81',subject:`${lang.name} language`,subSubject:'Language / linguistics',
        aux:[{type:'language',code:lang.aux,name:lang.name}],
        breakdown:`81 = Linguistics and languages; ${lang.languageClass} = the language-specific notation for ${lang.name}.`,
        explanation:`The title is about the ${lang.name} language itself, so the linguistic class is used rather than class 0.`,
        verifiedRule:true});
    }
  }

  // Place + subject patterns.
  const place=match(t,rules.places);
  let subject=match(t,rules.subjects);
  if(subject){
    let udc=subject.udc, aux=[...(subject.aux||[])], explanation=subject.explanation;
    if(place && subject.allowPlace!==false && !/international|foreign|diplomatic|relation/.test(t)){
      udc += place.code;
      aux.push({type:'place',code:place.code,name:place.name});
      explanation += ` Place auxiliary ${place.code} = ${place.name} is appended.`;
    }
    if(has(t,'dictionary')||has(t,'lexicon')||has(t,'glossary')){udc+='(038)';aux.push({type:'form',code:'(038)',name:'Dictionary'});}
    else if(has(t,'encyclopedia')||has(t,'encyclopaedia')){udc+='(031)';aux.push({type:'form',code:'(031)',name:'Encyclopaedia'});}
    else if(has(t,'handbook')||has(t,'manual')){udc+='(035)';aux.push({type:'form',code:'(035)',name:'Handbook / manual'});}
    else if(has(t,'textbook')){udc+='(075)';aux.push({type:'form',code:'(075)',name:'Textbook'});}
    return make(title,{...subject,udc,aux,explanation,breakdown:explanation,verifiedRule:true});
  }

  // Never manufacture a verified class from an unknown title.
  return make(title,{
    udc:'',mainClass:'',subject:'No verified local UDC match',
    subSubject:'',aux:[],
    breakdown:'No sufficiently specific verified rule is available for this title in the local dataset.',
    explanation:'No sufficiently specific verified UDC rule is available for this title in the local dataset. Do not substitute DDC or guess a UDC number.',
    verifiedRule:false
  },'Review');
}

app.get('/health',(req,res)=>res.json({ok:true,service:'UDC Classifier',version:'FINAL-MASTER-UDC'}));
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.post('/api/classify',(req,res)=>{try{res.json(classify(req.body?.title??req.body?.bookTitle??req.body?.query??''));}catch(e){res.status(500).json({error:'Classification failed',message:e.message});}});
app.post('/classify',(req,res)=>{try{res.json(classify(req.body?.title??req.body?.bookTitle??req.body?.query??''));}catch(e){res.status(500).json({error:'Classification failed',message:e.message});}});
const PORT=process.env.PORT||10000;
app.listen(PORT,()=>console.log(`UDC classifier listening on ${PORT}`));
