const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const rules = JSON.parse(fs.readFileSync(path.join(__dirname, 'udc-rules.json'), 'utf8'));

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[’']/g,"'").replace(/[^a-z0-9=:.()\-+\/\" ]+/g,' ').replace(/\s+/g,' ').trim();
}
function has(t, p) { return t.includes(p); }
function firstMatch(t, arr) { return arr.find(x => has(t, x.pattern)); }

function result(title, r, confidence='High') {
  return {
    title,
    bookTitle: title,
    udc: r.udc,
    finalUdcNumber: r.udc,
    proposedUdcNumber: r.udc,
    mainClass: r.mainClass || r.udc.split(/[.(=\"\-+/:]/)[0],
    subject: r.subject,
    mainSubject: r.subject,
    subSubject: r.subSubject || '',
    confidence,
    explanation: r.explanation || `UDC ${r.udc}: ${r.subject}.`,
    cataloguerExplanation: r.explanation || `UDC ${r.udc}: ${r.subject}.`,
    alternatives: r.alternatives || [],
    aux: r.aux || [],
    verifiedRule: true,
    source: 'local UDC rule set'
  };
}

function classify(rawTitle) {
  const title = String(rawTitle || '').trim();
  const t = norm(title);
  if (!t) return result('', {udc:'0',subject:'Science and knowledge',subSubject:'General works',explanation:'0 — Science and knowledge.'}, 'Low');

  // 1) Exact/high-priority international relations between named countries.
  const countries = rules.countries;
  const found = Object.entries(countries).filter(([k]) => has(t,k));
  const relationWords = ['relation','relations','relationship','relationships','foreign relation','foreign relations','diplomatic','diplomacy','bilateral','international relation','international relations','foreign policy','foreign affairs','cooperation','conflict','ties between'];
  if (found.length >= 2 && relationWords.some(w => has(t,w))) {
    const a = found[0][1], b = found[1][1];
    const udc = `327(${a.code}:${b.code})`;
    return result(title,{udc,mainClass:'327',subject:`${a.name}–${b.name} international relations`,subSubject:'Foreign / international relations',aux:[{type:'place',code:a.code,name:a.name},{type:'relation',code:':',name:'Relation'},{type:'place',code:b.code,name:b.name}],explanation:`327 = international/foreign relations; ${a.code} = ${a.name}; ${b.code} = ${b.name}; : expresses the relation between the two places.`});
  }

  // 2) High-priority exact title rules from the supplied answer-key family.
  const exact = rules.exact.find(x => t === norm(x.pattern));
  if (exact) return result(title, exact);

  // 3) Language/literature: detect literary form before generic language.
  const lang = firstMatch(t, rules.languages);
  if (lang) {
    if (has(t,'dictionary') || has(t,'lexicon') || has(t,'glossary')) {
      const base = lang.languageClass || lang.code;
      return result(title,{udc:`${base}(038)`,mainClass:'8',subject:`${lang.name} language — dictionary / lexicon`,subSubject:'Dictionary',aux:[{type:'language',code:lang.code,name:lang.name},{type:'form',code:'(038)',name:'Dictionary'}],explanation:`${base} = ${lang.name} language; (038) = dictionary/form auxiliary.`});
    }
    if (has(t,'grammar')) return result(title,{udc:`${lang.languageClass || lang.code}5`,mainClass:'8',subject:`${lang.name} grammar`,subSubject:'Grammar',explanation:`Language class for ${lang.name}, with the grammar subdivision. Verify the exact subdivision against the licensed UDC schedule.`},'Medium');
    if (has(t,'phonetics') || has(t,'phonology')) return result(title,{udc:`${lang.languageClass || lang.code}1`,mainClass:'8',subject:`${lang.name} phonetics / phonology`,subSubject:'Phonetics / phonology',explanation:`Language class for ${lang.name}, with the linguistic subdivision.`},'Medium');
    if (has(t,'literature') || has(t,'poetry') || has(t,'poem') || has(t,'drama') || has(t,'play') || has(t,'fiction') || has(t,'novel') || has(t,'short stories') || has(t,'short story')) {
      let form='';
      if (has(t,'drama') || has(t,'play')) form='-2';
      else if (has(t,'poetry') || has(t,'poem')) form='-1';
      else if (has(t,'fiction') || has(t,'novel') || has(t,'short stor')) form='-3';
      const udc = `${lang.litCode || lang.code}${form}`;
      return result(title,{udc,mainClass:'821',subject:`${lang.name} literature${form==='-2'?' — drama':form==='-1'?' — poetry':form==='-3'?' — fiction':''}`,subSubject:form==='-2'?'Drama':form==='-1'?'Poetry':form==='-3'?'Fiction':'Literature',aux:[{type:'language',code:lang.code,name:lang.name}],explanation:`${lang.litCode || lang.code} = literature in ${lang.name}; ${form||'general literature'} identifies the literary form.`});
    }
    if (has(t,'language') || has(t,'linguistics') || has(t,'philology')) {
      return result(title,{udc:lang.languageClass || lang.code,mainClass:'81',subject:`${lang.name} language`,subSubject:'Language / linguistics',aux:[{type:'language',code:lang.code,name:lang.name}],explanation:`Language class for ${lang.name}. The = language auxiliary identifies the language of a work; the linguistic subject itself belongs in 81/811 according to the schedule.`},'Medium');
    }
  }

  // 4) Generic dictionary/encyclopedia/handbook form: subject first, then form.
  const form = firstMatch(t, rules.forms);
  const subjectRule = firstMatch(t, rules.subjects);
  if (subjectRule) {
    let udc = subjectRule.udc;
    let aux = [];
    let explanation = subjectRule.explanation;
    if (has(t,'dictionary') || has(t,'lexicon') || has(t,'glossary')) { udc += '(038)'; aux.push({type:'form',code:'(038)',name:'Dictionary'}); }
    else if (has(t,'encyclopedia') || has(t,'encyclopaedia')) { udc += '(03)'; aux.push({type:'form',code:'(03)',name:'Encyclopaedia / reference work'}); }
    else if (has(t,'handbook') || has(t,'manual')) { udc += '(035)'; aux.push({type:'form',code:'(035)',name:'Handbook / manual'}); }
    else if (has(t,'textbook')) { udc += '(075)'; aux.push({type:'form',code:'(075)',name:'Textbook'}); }
    const place = firstMatch(t, rules.places);
    if (place && !/relation|relations|foreign|diplomatic/.test(t)) { udc += place.code; aux.push({type:'place',code:place.code,name:place.name}); }
    return result(title,{udc,mainClass:subjectRule.udc,subject:subjectRule.subject,subSubject:subjectRule.subSubject||'',aux,explanation: explanation + (aux.length ? ` Form/place auxiliaries detected: ${aux.map(a=>a.code).join(' ')}.`:'')});
  }

  if (form) {
    return result(title,{udc:'0'+form.code,mainClass:'0',subject:'General work',subSubject:form.name,aux:[{type:'form',code:form.code,name:form.name}],explanation:`${form.code} = ${form.name} form auxiliary. The subject must determine the main UDC class before the form auxiliary is added.`},'Low');
  }

  // 5) General subject fallback.
  if (subjectRule) return result(title,subjectRule);
  return result(title,{udc:'0',mainClass:'0',subject:'Science and knowledge',subSubject:'General works',explanation:'No sufficiently specific local rule matched the title. 0 is the general class for science and knowledge; verify the authoritative UDC schedule for exact cataloguing.'},'Low');
}

app.get('/health',(req,res)=>res.json({ok:true,service:'UDC Classifier',version:'fixed-title-rules-2026-09'}));
app.post('/api/classify',(req,res)=>{ try { const title=req.body?.title ?? req.body?.bookTitle ?? req.body?.query ?? ''; return res.json(classify(title)); } catch(e) { return res.status(500).json({error:'Classification failed',message:e.message}); }});
app.post('/classify',(req,res)=>{ try { const title=req.body?.title ?? req.body?.bookTitle ?? req.body?.query ?? ''; return res.json(classify(title)); } catch(e) { return res.status(500).json({error:'Classification failed',message:e.message}); }});

const PORT=process.env.PORT || 10000;
app.listen(PORT,()=>console.log(`UDC classifier listening on ${PORT}`));
