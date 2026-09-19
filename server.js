const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({limit:'2mb'}));
app.use(express.static(__dirname));

const ROOT = __dirname;
const RULES_FILE = path.join(ROOT, 'udc-rules.json');

/*
  FULL-UDC ENGINE
  ----------------
  This server is designed to load an authorized/licensed UDC Master Reference
  File (MRF) placed beside server.js. It does NOT contain or redistribute the
  copyrighted MRF itself.

  Supported local data:
    - UDC MRF XML export: udc-mrf.xml / udc.xml
    - tagged text export: udc-mrf.txt / udc.txt
    - JSON/JSONL: udc-mrf.json / udc.json
    - CSV: udc-mrf.csv / udc.csv

  The MRF is the authoritative UDC source. The engine first searches the MRF,
  then the local rule set, then uses safe subject logic. It never labels an
  unverified fallback as "verified".
*/

function readJsonSafe(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file,'utf8')); }
  catch { return fallback; }
}
const rules = readJsonSafe(RULES_FILE, {
  exact: [], countries: {}, languages: [], forms: [], subjects: [], places: []
});

const DATA_FILES = [
  'udc-mrf.json','udc.json','udc-mrf.jsonl','udc.jsonl',
  'udc-mrf.xml','udc.xml','udc-mrf.txt','udc.txt',
  'udc-mrf.csv','udc.csv'
];

function locateDataFile() {
  for (const f of DATA_FILES) {
    const p = path.join(ROOT,f);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const MRF_FILE = locateDataFile();
let MRF = [];

function cleanText(v) {
  return String(v ?? '').replace(/\s+/g,' ').trim();
}
function norm(s) {
  return cleanText(s).toLowerCase()
    .normalize('NFKD').replace(/[’']/g,"'")
    .replace(/[^a-z0-9=:.()\-+\/" ]+/g,' ')
    .replace(/\s+/g,' ').trim();
}
function escReg(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
}
function has(t,p) { return t.includes(norm(p)); }
function firstMatch(t,arr=[]) { return arr.find(x => has(t,x.pattern || x.term || x.name || '')); }

function xmlText(xml, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'i');
  const m = xml.match(re);
  return m ? cleanText(m[1].replace(/<[^>]+>/g,' ')) : '';
}

function loadMRF(file) {
  if (!file) return [];
  const ext = path.extname(file).toLowerCase();
  try {
    const raw = fs.readFileSync(file,'utf8');

    if (ext === '.json') {
      const j = JSON.parse(raw);
      const arr = Array.isArray(j) ? j : (j.records || j.data || j.classes || []);
      return arr.map(normalizeRecord).filter(x => x.udc);
    }

    if (ext === '.jsonl') {
      return raw.split(/\r?\n/).filter(Boolean).map(line => {
        try { return normalizeRecord(JSON.parse(line)); } catch { return null; }
      }).filter(Boolean).filter(x => x.udc);
    }

    if (ext === '.csv') {
      const lines = raw.split(/\r?\n/).filter(Boolean);
      if (!lines.length) return [];
      const headers = splitCSV(lines[0]).map(norm);
      return lines.slice(1).map(line => {
        const vals = splitCSV(line);
        const obj = {};
        headers.forEach((h,i)=>obj[h]=vals[i] ?? '');
        return normalizeRecord(obj);
      }).filter(x=>x.udc);
    }

    if (ext === '.xml') {
      // Accept common UDC export field names without assuming one vendor schema.
      const blocks = raw.match(/<(?:record|class|udc|entry|concept)\b[\s\S]*?<\/(?:record|class|udc|entry|concept)>/gi) || [];
      const out = [];
      for (const b of blocks) {
        const udc = xmlText(b,'notation') || xmlText(b,'udc') || xmlText(b,'code') || xmlText(b,'notationText');
        const caption = xmlText(b,'caption') || xmlText(b,'title') || xmlText(b,'term') || xmlText(b,'preferredTerm') || xmlText(b,'description');
        const scope = xmlText(b,'scope') || xmlText(b,'scopeNote') || xmlText(b,'note') || '';
        if (udc) out.push(normalizeRecord({udc,caption,scope}));
      }
      return out;
    }

    // Tagged text: look for a UDC notation field followed by a caption/term.
    const out = [];
    let current = {};
    for (const line of raw.split(/\r?\n/)) {
      const l = line.trim();
      if (/^(?:udc|notation|code|class)\s*[:=]\s*/i.test(l)) {
        if (current.udc) out.push(normalizeRecord(current));
        current = {udc:l.replace(/^[^:=]+[:=]\s*/,'')};
      } else if (/^(?:caption|term|title|description|preferred)\s*[:=]\s*/i.test(l)) {
        current.caption = l.replace(/^[^:=]+[:=]\s*/,'');
      } else if (/^(?:note|scope)\s*[:=]\s*/i.test(l)) {
        current.scope = l.replace(/^[^:=]+[:=]\s*/,'');
      }
    }
    if (current.udc) out.push(normalizeRecord(current));
    return out;
  } catch(e) {
    console.error('MRF load error:',e.message);
    return [];
  }
}

function splitCSV(line) {
  const a=[]; let cur='', q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c === '"') { if(q && line[i+1]==='"'){cur+='"';i++;} else q=!q; }
    else if(c===',' && !q){a.push(cur);cur='';}
    else cur+=c;
  }
  a.push(cur); return a.map(x=>x.trim());
}

function normalizeRecord(r) {
  const udc = cleanText(r.udc || r.notation || r.code || r.classification || r.class || r.notationText);
  const caption = cleanText(r.caption || r.term || r.title || r.subject || r.description || r.preferredTerm || r.name);
  const scope = cleanText(r.scope || r.scopeNote || r.note || r.explanation || '');
  return {udc, caption, scope, raw:r};
}

MRF = loadMRF(MRF_FILE);
console.log(`UDC data: ${MRF_FILE ? path.basename(MRF_FILE) : 'No MRF file found'}; records=${MRF.length}`);

function scoreRecord(r,tokens,title) {
  const hay = norm(`${r.caption} ${r.scope}`);
  let score = 0;
  for (const tok of tokens) {
    if (tok.length < 3) continue;
    if (hay.includes(tok)) score += 4;
    if (norm(r.caption).split(' ').includes(tok)) score += 3;
  }
  // Prefer more specific records when several are close.
  score += Math.min(String(r.udc).length,30) * 0.05;
  return score;
}

function searchMRF(title) {
  if (!MRF.length) return null;
  const t = norm(title);
  const tokens = [...new Set(t.split(' ').filter(x=>x.length>=3))];
  if (!tokens.length) return null;

  const ranked = MRF.map(r=>({r,score:scoreRecord(r,tokens,t)}))
    .filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,8);

  if (!ranked.length) return null;

  // Require a meaningful lexical match; don't force a random class.
  const top=ranked[0];
  if (top.score < Math.max(4, tokens.length*1.5)) return null;
  return {best:top.r, alternatives:ranked.slice(1,5).map(x=>x.r)};
}

function result(title,r,confidence='High',source='local UDC rule set') {
  return {
    title, bookTitle:title,
    udc:r.udc, finalUdcNumber:r.udc, proposedUdcNumber:r.udc,
    mainClass:r.mainClass || String(r.udc).split(/[.(="\-+/:]/)[0],
    subject:r.subject || r.caption || '',
    mainSubject:r.mainSubject || r.subject || r.caption || '',
    subSubject:r.subSubject || '',
    confidence,
    explanation:r.explanation || r.scope || `UDC ${r.udc}: ${r.subject || r.caption || ''}.`,
    cataloguerExplanation:r.explanation || r.scope || '',
    alternatives:r.alternatives || [],
    aux:r.aux || [],
    verifiedRule: source.includes('MRF') || source.includes('local UDC rule'),
    source
  };
}

function classify(rawTitle) {
  const title=cleanText(rawTitle);
  const t=norm(title);
  if(!t) return result('',{udc:'0',subject:'Science and knowledge',subSubject:'General works',explanation:'Enter a book title.'},'Low','input validation');

  // 1. Exact rules supplied with the application.
  const exact=(rules.exact||[]).find(x=>t===norm(x.pattern));
  if(exact) return result(title,exact,'High','local UDC rule set');

  // 2. If a licensed MRF is installed, it is the primary authoritative source.
  const hit=searchMRF(title);
  if(hit) {
    const r=hit.best;
    return result(title,{
      udc:r.udc, caption:r.caption, scope:r.scope,
      subject:r.caption, alternatives:hit.alternatives,
      explanation:`Matched against the locally installed authorized UDC MRF record: ${r.udc} — ${r.caption}.`
    },'High','authorized UDC MRF');
  }

  // 3. Special combination: two named places + international relations.
  const countries=rules.countries||{};
  const found=Object.entries(countries).filter(([k])=>has(t,k));
  const relationWords=['relation','relations','relationship','relationships','foreign relation','foreign relations','diplomatic','diplomacy','bilateral','international relation','international relations','foreign policy','foreign affairs','cooperation','conflict','ties between'];
  if(found.length>=2 && relationWords.some(w=>has(t,w))) {
    const a=found[0][1],b=found[1][1];
    const udc=`327(${a.code}:${b.code})`;
    return result(title,{udc,mainClass:'327',subject:`${a.name}–${b.name} international relations`,subSubject:'Foreign / international relations',aux:[{type:'place',code:a.code,name:a.name},{type:'relation',code:':',name:'Relation'},{type:'place',code:b.code,name:b.name}],explanation:`327 = international relations; ${a.code} = ${a.name}; : = relation; ${b.code} = ${b.name}.`});
  }

  // 4. Local language/literature rules.
  const lang=firstMatch(t,rules.languages||[]);
  if(lang) {
    if(has(t,'dictionary')||has(t,'lexicon')||has(t,'glossary')) {
      const base=lang.languageClass||lang.code;
      return result(title,{udc:`${base}(038)`,mainClass:'8',subject:`${lang.name} language — dictionary / lexicon`,subSubject:'Dictionary',aux:[{type:'language',code:lang.code,name:lang.name},{type:'form',code:'(038)',name:'Dictionary'}],explanation:`${base} = ${lang.name} language; (038) = dictionary/form auxiliary.`});
    }
    if(has(t,'grammar')) return result(title,{udc:`${lang.languageClass||lang.code}5`,mainClass:'8',subject:`${lang.name} grammar`,subSubject:'Grammar',explanation:`Language grammar rule from the local UDC rule set.`},'Medium');
    if(has(t,'language')||has(t,'linguistics')||has(t,'philology')) return result(title,{udc:lang.languageClass||lang.code,mainClass:'81',subject:`${lang.name} language`,subSubject:'Language / linguistics',explanation:`Language classification from the local UDC rule set.`},'Medium');
    if(has(t,'literature')||has(t,'poetry')||has(t,'poem')||has(t,'drama')||has(t,'play')||has(t,'fiction')||has(t,'novel')||has(t,'short stor')) {
      let form='';
      if(has(t,'drama')||has(t,'play')) form='-2';
      else if(has(t,'poetry')||has(t,'poem')) form='-1';
      else if(has(t,'fiction')||has(t,'novel')||has(t,'short stor')) form='-3';
      const udc=`${lang.litCode||lang.code}${form}`;
      return result(title,{udc,mainClass:'821',subject:`${lang.name} literature`,subSubject:form==='-2'?'Drama':form==='-1'?'Poetry':form==='-3'?'Fiction':'Literature',explanation:`Literature rule from the local UDC rule set; exact licensed MRF should be used for final verification.`},'Medium');
    }
  }

  // 5. Subject + common form/place rules.
  const subjectRule=firstMatch(t,rules.subjects||[]);
  if(subjectRule) {
    let udc=subjectRule.udc, aux=[], explanation=subjectRule.explanation||'';
    if(has(t,'dictionary')||has(t,'lexicon')||has(t,'glossary')) {udc+='(038)';aux.push({type:'form',code:'(038)',name:'Dictionary'});}
    else if(has(t,'encyclopedia')||has(t,'encyclopaedia')) {udc+='(03)';aux.push({type:'form',code:'(03)',name:'Encyclopaedia'});}
    else if(has(t,'handbook')||has(t,'manual')) {udc+='(035)';aux.push({type:'form',code:'(035)',name:'Handbook / manual'});}
    else if(has(t,'textbook')) {udc+='(075)';aux.push({type:'form',code:'(075)',name:'Textbook'});}
    const place=firstMatch(t,rules.places||[]);
    if(place && !/relation|relations|foreign|diplomatic/.test(t)){udc+=place.code;aux.push({type:'place',code:place.code,name:place.name});}
    return result(title,{udc,mainClass:subjectRule.udc,subject:subjectRule.subject,subSubject:subjectRule.subSubject||'',aux,explanation:explanation+(aux.length?` Form/place auxiliaries: ${aux.map(a=>a.code).join(' ')}.`:'')});
  }

  // Never pretend that an unverified fallback is authoritative.
  return result(title,{
    udc:'',mainClass:'',subject:'No verified UDC match',subSubject:'',
    explanation:'No sufficiently specific match was found in the installed UDC data or local rule set. Install the authorized UDC MRF to enable full-schedule searching.',
    alternatives:[]
  },'Low','no verified match');
}

app.get('/health',(req,res)=>res.json({
  ok:true, service:'UDC Full-Schedule Classifier',
  version:'mrf-ready-2026',
  mrfFile:MRF_FILE ? path.basename(MRF_FILE) : null,
  mrfRecords:MRF.length,
  message:MRF.length ? 'Authorized UDC data loaded.' : 'MRF not installed; local rules only.'
}));

app.get('/api/status',(req,res)=>res.json({
  mrfInstalled:!!MRF_FILE, mrfFile:MRF_FILE ? path.basename(MRF_FILE):null,
  records:MRF.length,
  dataFiles:DATA_FILES
}));

app.get('/',(req,res)=>res.sendFile(path.join(ROOT,'index.html')));

app.post('/api/classify',(req,res)=>{
  try {
    const title=req.body?.title ?? req.body?.bookTitle ?? req.body?.query ?? '';
    return res.json(classify(title));
  } catch(e) {
    return res.status(500).json({error:'Classification failed',message:e.message});
  }
});
app.post('/classify',(req,res)=>{
  try {
    const title=req.body?.title ?? req.body?.bookTitle ?? req.body?.query ?? '';
    return res.json(classify(title));
  } catch(e) {
    return res.status(500).json({error:'Classification failed',message:e.message});
  }
});

const PORT=process.env.PORT||10000;
app.listen(PORT,()=>console.log(`UDC full-schedule classifier listening on ${PORT}`));
