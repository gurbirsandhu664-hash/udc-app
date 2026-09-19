const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

const rulesPath = path.join(__dirname, 'udc-rules.json');
let rules = { exact: [], countries: {}, languages: [], forms: [], subjects: [], places: [] };

try {
  if (fs.existsSync(rulesPath)) {
    const loaded = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    rules = {
      ...rules,
      ...loaded,
      exact: Array.isArray(loaded.exact) ? loaded.exact : [],
      countries: loaded.countries || {},
      languages: Array.isArray(loaded.languages) ? loaded.languages : [],
      forms: Array.isArray(loaded.forms) ? loaded.forms : [],
      subjects: Array.isArray(loaded.subjects) ? loaded.subjects : [],
      places: Array.isArray(loaded.places) ? loaded.places : []
    };
  }
} catch (e) {
  console.error('UDC rules load warning:', e.message);
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9=:.()\-+\/" ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function has(t, p) { return t.includes(p); }
function firstMatch(t, arr) { return arr.find(x => x && has(t, norm(x.pattern || ''))); }

function result(title, r, confidence='High') {
  return {
    title,
    bookTitle: title,
    udc: r.udc,
    finalUdcNumber: r.udc,
    proposedUdcNumber: r.udc,
    mainClass: r.mainClass || String(r.udc).split(/[.(="\-+/:]/)[0],
    subject: r.subject,
    mainSubject: r.mainSubject || r.subject,
    subSubject: r.subSubject || '',
    confidence,
    explanation: r.explanation || `UDC ${r.udc}: ${r.subject}.`,
    cataloguerExplanation: r.explanation || `UDC ${r.udc}: ${r.subject}.`,
    alternatives: r.alternatives || [],
    aux: r.aux || [],
    verifiedRule: r.verifiedRule !== false,
    source: r.source || 'UDC Summary / local UDC rule set'
  };
}

/*
  Verified UDC Summary language entries.
  These are fallback entries only when the local rules file has no matching
  language entry. They do NOT claim to be the complete UDC MRF.
*/
const LANGUAGE_FALLBACKS = [
  { keys:['hindi'], name:'Hindi', languageClass:'811.214.21', litCode:'821.214.21', code:'=214.21' },
  { keys:['punjabi','panjabi'], name:'Panjabi / Punjabi', languageClass:'811.214.27', litCode:'821.214.27', code:'=214.27' },
  { keys:['urdu'], name:'Urdu', languageClass:'811.214.22', litCode:'821.214.22', code:'=214.22' },
  { keys:['bengali','bangla'], name:'Bengali (Bangla)', languageClass:'811.214.32', litCode:'821.214.32', code:'=214.32' },
  { keys:['english'], name:'English', languageClass:'811.111', litCode:'821.111', code:'=111' },
  { keys:['french'], name:'French', languageClass:'811.133.1', litCode:'821.133.1', code:'=133.1' },
  { keys:['german'], name:'German', languageClass:'811.112', litCode:'821.112', code:'=112' },
  { keys:['spanish'], name:'Spanish', languageClass:'811.134.2', litCode:'821.134.2', code:'=134.2' }
];

function findLanguage(t) {
  const local = firstMatch(t, rules.languages);
  if (local) return local;
  return LANGUAGE_FALLBACKS.find(l => l.keys.some(k => has(t, k)));
}

function classify(rawTitle) {
  const title = String(rawTitle || '').trim();
  const t = norm(title);

  if (!t) {
    return result('', {
      udc:'0',
      mainClass:'0',
      subject:'Science and knowledge',
      subSubject:'General works',
      explanation:'0 — Science and knowledge.',
      source:'UDC Summary / local UDC rule set'
    }, 'Low');
  }

  // Exact local answer-key rules have priority.
  const exact = rules.exact.find(x => t === norm(x.pattern));
  if (exact) return result(title, exact);

  // Explicit coordination of two equally important main classes.
  // Example: Science and arts -> 5+7.
  const coordination = [
    [/\bscience\b/, '5', 'Mathematics and natural sciences'],
    [/\barts?\b/, '7', 'The arts'],
    [/\btechnology\b|\bengineering\b/, '6', 'Applied sciences. Medicine. Technology'],
    [/\bsocial sciences?\b/, '3', 'Social sciences'],
    [/\blanguage\b|\blinguistics\b/, '8', 'Language. Linguistics. Literature']
  ];
  if (/\band\b|\+/.test(t)) {
    const hits = coordination.filter(([re]) => re.test(t));
    const unique = [];
    for (const h of hits) if (!unique.some(x => x[1] === h[1])) unique.push(h);
    if (unique.length >= 2) {
      const udc = unique.map(x => x[1]).join('+');
      return result(title, {
        udc,
        mainClass: udc,
        subject: unique.map(x => x[2]).join(' and '),
        subSubject: 'Coordinated subjects',
        aux: unique.map(x => ({type:'main-class', code:x[1], name:x[2]})),
        explanation: unique.map(x => `${x[1]} = ${x[2]}`).join('; ') +
          '; + = coordination of equally important subjects.',
        source:'UDC Summary / local UDC rule set'
      });
    }
  }

  // Language/literature.
  const lang = findLanguage(t);
  if (lang) {
    const languageClass = lang.languageClass || lang.udc;
    const litCode = lang.litCode || lang.literatureClass;

    if (has(t,'dictionary') || has(t,'lexicon') || has(t,'glossary')) {
      return result(title, {
        udc: `${languageClass}(038)`,
        mainClass:'811',
        subject:`${lang.name} language — dictionary / lexicon`,
        subSubject:'Dictionary',
        aux:[
          {type:'language', code:lang.code || '', name:lang.name},
          {type:'form', code:'(038)', name:'Dictionary'}
        ],
        explanation:`${languageClass} = ${lang.name} language; (038) = dictionary/form auxiliary.`,
        source:'UDC Summary / local UDC rule set'
      });
    }

    if (has(t,'grammar')) {
      return result(title, {
        udc:`${languageClass}36`,
        mainClass:'811',
        subject:`${lang.name} grammar`,
        subSubject:'Grammar',
        explanation:`${languageClass} = ${lang.name} language; 36 = grammar subdivision.`,
        source:'UDC Summary / local UDC rule set'
      });
    }

    if (has(t,'phonetics') || has(t,'phonology')) {
      return result(title, {
        udc:`${languageClass}34`,
        mainClass:'811',
        subject:`${lang.name} phonetics / phonology`,
        subSubject:'Phonetics / phonology',
        explanation:`${languageClass} = ${lang.name} language; 34 = phonetics/phonology subdivision.`,
        source:'UDC Summary / local UDC rule set'
      });
    }

    if (has(t,'literature') || has(t,'poetry') || has(t,'poem') ||
        has(t,'drama') || has(t,'play') || has(t,'fiction') ||
        has(t,'novel') || has(t,'short stor')) {
      let form = '';
      if (has(t,'drama') || has(t,'play')) form = '-2';
      else if (has(t,'poetry') || has(t,'poem')) form = '-1';
      else if (has(t,'fiction') || has(t,'novel') || has(t,'short stor')) form = '-3';

      return result(title, {
        udc:`${litCode}${form}`,
        mainClass:'821',
        subject:`${lang.name} literature${form==='-2'?' — drama':form==='-1'?' — poetry':form==='-3'?' — fiction':''}`,
        subSubject:form==='-2'?'Drama':form==='-1'?'Poetry':form==='-3'?'Fiction':'Literature',
        aux:[{type:'language',code:lang.code || '',name:lang.name}],
        explanation:`${litCode} = literature in ${lang.name}; ${form || 'general literature'} identifies the literary form.`,
        source:'UDC Summary / local UDC rule set'
      });
    }

    if (has(t,'language') || has(t,'linguistics') || has(t,'philology')) {
      return result(title, {
        udc:languageClass,
        mainClass:'811',
        subject:`${lang.name} language`,
        subSubject:'Language / linguistics',
        aux:[{type:'language',code:lang.code || '',name:lang.name}],
        explanation:`${languageClass} = ${lang.name} language.`,
        source:'UDC Summary / local UDC rule set'
      });
    }
  }

  // Local subject rules + common form auxiliaries.
  const subjectRule = firstMatch(t, rules.subjects);
  if (subjectRule) {
    let udc = subjectRule.udc;
    const aux = [];
    let explanation = subjectRule.explanation || `UDC ${udc}: ${subjectRule.subject}.`;

    if (has(t,'dictionary') || has(t,'lexicon') || has(t,'glossary')) {
      udc += '(038)';
      aux.push({type:'form',code:'(038)',name:'Dictionary'});
    } else if (has(t,'encyclopedia') || has(t,'encyclopaedia')) {
      udc += '(03)';
      aux.push({type:'form',code:'(03)',name:'Encyclopaedia / reference work'});
    } else if (has(t,'handbook') || has(t,'manual')) {
      udc += '(035)';
      aux.push({type:'form',code:'(035)',name:'Handbook / manual'});
    } else if (has(t,'textbook')) {
      udc += '(075)';
      aux.push({type:'form',code:'(075)',name:'Textbook'});
    }

    const place = firstMatch(t, rules.places);
    if (place && !/relation|relations|foreign|diplomatic/.test(t)) {
      udc += place.code;
      aux.push({type:'place',code:place.code,name:place.name});
    }

    return result(title, {
      ...subjectRule,
      udc,
      mainClass:subjectRule.udc,
      aux,
      explanation: explanation + (aux.length ? ` Auxiliaries detected: ${aux.map(a=>a.code).join(' ')}.` : '')
    });
  }

  return result(title, {
    udc:'0',
    mainClass:'0',
    subject:'No sufficiently specific UDC match',
    subSubject:'Unverified',
    explanation:'No sufficiently specific local/summary UDC rule matched this title. Do not present 0 as a verified subject classification; consult the authorized UDC schedule/MRF for a complete classification.',
    verifiedRule:false,
    source:'No verified local UDC match'
  }, 'Low');
}

app.get('/health', (req,res) => res.json({
  ok:true,
  service:'UDC Classifier',
  version:'udc-summary-language-fallback-2026-09',
  rulesLoaded: fs.existsSync(rulesPath)
}));

app.get('/', (req,res) => res.sendFile(path.join(__dirname,'index.html')));

app.post('/api/classify', (req,res) => {
  try {
    const title = req.body?.title ?? req.body?.bookTitle ?? req.body?.query ?? '';
    return res.json(classify(title));
  } catch(e) {
    return res.status(500).json({error:'Classification failed',message:e.message});
  }
});

app.post('/classify', (req,res) => {
  try {
    const title = req.body?.title ?? req.body?.bookTitle ?? req.body?.query ?? '';
    return res.json(classify(title));
  } catch(e) {
    return res.status(500).json({error:'Classification failed',message:e.message});
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`UDC classifier listening on ${PORT}`));
