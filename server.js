const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, 'udc-rules.json'), 'utf8'));

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9=:.()+\/\-? ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Exact word/phrase matching. This is deliberately NOT String.includes(),
// so "art" can never match the middle of "heart".
function has(t, phrase) {
  const q = norm(phrase).replace(/[?]/g, '').trim();
  if (!q) return false;
  const words = q.split(' ').filter(Boolean).map(w => w.replace(/[.*+^${}()|[\]\\]/g, '\\$&'));
  return new RegExp('(^|\\s)' + words.join('\\s+') + '(?=$|\\s)', 'i').test(t);
}
function matchPatterns(t, patterns) { return (patterns || []).some(p => has(t, p)); }

// Turns common user questions into the actual book/title query.
// Examples: "What is the UDC number for heart disease?" -> "heart disease"
function cleanQuery(raw) {
  let t = norm(raw).replace(/\?/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(please\s+)?(classify|classification|classify\s+the\s+book|give\s+the\s+udc|find\s+the\s+udc|tell\s+me\s+the\s+udc)\s*/i, '');
  t = t.replace(/^(what|which)\s+(is|are)\s+(the\s+)?(udc|classification)(\s+(number|code))?\s*(for|of)\s*/i, '');
  t = t.replace(/^(udc\s+(number|classification|code)\s*(for|of)\s+)/i, '');
  t = t.replace(/^(classify|classification)\s+(this|the\s+book|the\s+title)\s*/i, '');
  t = t.replace(/\s+(please)?\s*(what is|which is|give me)\s+(the\s+)?(udc|classification).*/i, '');
  return t.trim();
}

function makeResult(title, r, confidence = 'High') {
  return {
    title,
    bookTitle: title,
    udc: r.udc,
    finalUdcNumber: r.udc,
    proposedUdcNumber: r.udc,
    mainClass: r.mainClass || r.udc,
    subject: r.subject,
    mainSubject: r.subject,
    subSubject: r.subSubject || '',
    confidence,
    explanation: r.explanation || `UDC ${r.udc}: ${r.subject}.`,
    cataloguerExplanation: r.explanation || `UDC ${r.udc}: ${r.subject}.`,
    alternatives: r.alternatives || [],
    aux: r.aux || [],
    verifiedRule: confidence === 'High',
    source: 'UDC Summary-level local rule set'
  };
}

function classify(rawTitle) {
  const original = String(rawTitle || '').trim();
  const t = cleanQuery(original);
  if (!t) return makeResult(original, {
    udc: '0', mainClass: '0', subject: 'Science and knowledge', subSubject: 'General works',
    explanation: 'Enter a book title or a classification question.'
  }, 'Low');

  // 1. Exact high-priority rules. Compound notation must be decided before
  // individual keywords (e.g. 5+7 and 5/6).
  const exact = (RULES.exact || []).find(x => t === norm(x.pattern));
  if (exact) return makeResult(original, exact, 'High');

  // 2. Medical phrases before generic "art"/"science" rules.
  // These are phrase rules, so "heart disease" is not interpreted as "art".
  const medical = (RULES.medical || []);
  const med = medical.find(x => matchPatterns(t, x.patterns));
  if (med) return makeResult(original, med, 'High');

  // 3. International relations between two explicitly named places.
  const foundPlaces = [];
  for (const p of (RULES.places || [])) {
    if (matchPatterns(t, p.patterns) && !foundPlaces.some(x => x.code === p.code)) foundPlaces.push(p);
  }
  const relationWords = (RULES.relationWords || []);
  if (foundPlaces.length >= 2 && relationWords.some(w => has(t, w))) {
    const a = foundPlaces[0], b = foundPlaces[1];
    return makeResult(original, {
      udc: `327${a.code}:${b.code}`,
      mainClass: '327',
      subject: `${a.name}–${b.name} international relations`,
      subSubject: 'International / foreign relations',
      aux: [
        { type: 'place', code: a.code, name: a.name },
        { type: 'relation', code: ':', name: 'Relation' },
        { type: 'place', code: b.code, name: b.name }
      ],
      explanation: `327 = international relations; ${a.code} = ${a.name}; : = relation between places; ${b.code} = ${b.name}.`
    }, 'High');
  }

  // 4. Language/literature. Literary form is checked before generic language.
  for (const lang of (RULES.languages || [])) {
    if (!matchPatterns(t, lang.patterns)) continue;
    const isDict = matchPatterns(t, ['dictionary', 'lexicon', 'glossary']);
    const isEncyclopedia = matchPatterns(t, ['encyclopedia', 'encyclopaedia']);
    const isGrammar = has(t, 'grammar');
    const isPhonetics = has(t, 'phonetics') || has(t, 'phonology');
    const isLiterature = matchPatterns(t, ['literature', 'poetry', 'poem', 'drama', 'play', 'fiction', 'novel', 'short story', 'short stories']);

    if (isDict) return makeResult(original, {
      udc: `${lang.languageClass}(038)`, mainClass: '811',
      subject: `${lang.name} language — dictionary / lexicon`, subSubject: 'Dictionary',
      aux: [{type:'language',code:lang.languageClass,name:lang.name},{type:'form',code:'(038)',name:'Dictionary / lexicon'}],
      explanation: `${lang.languageClass} = ${lang.name} language; (038) = dictionary / lexicon form auxiliary.`
    }, 'High');

    if (isEncyclopedia) return makeResult(original, {
      udc: `${lang.languageClass}(03)`, mainClass: '811',
      subject: `${lang.name} language — encyclopaedia`, subSubject: 'Encyclopaedia / reference work',
      aux: [{type:'language',code:lang.languageClass,name:lang.name},{type:'form',code:'(03)',name:'Encyclopaedia'}],
      explanation: `${lang.languageClass} = ${lang.name} language; (03) = encyclopaedia/reference-work form auxiliary.`
    }, 'High');

    if (isLiterature) {
      let suffix = '', label = 'Literature';
      if (has(t,'drama') || has(t,'play')) { suffix = '-2'; label = 'Drama'; }
      else if (has(t,'poetry') || has(t,'poem')) { suffix = '-1'; label = 'Poetry'; }
      else if (has(t,'fiction') || has(t,'novel') || has(t,'short story') || has(t,'short stories')) { suffix = '-3'; label = 'Fiction'; }
      return makeResult(original, {
        udc: `${lang.litCode}${suffix}`, mainClass: '821',
        subject: `${lang.name} literature — ${label}`, subSubject: label,
        aux: [{type:'language',code:lang.litCode,name:lang.name}],
        explanation: `${lang.litCode} = literature in ${lang.name}; ${suffix || 'general literature'} identifies the literary form.`
      }, 'High');
    }

    if (isGrammar) return makeResult(original, {
      udc: `${lang.languageClass}.5`, mainClass: '811', subject: `${lang.name} grammar`, subSubject: 'Grammar',
      aux: [{type:'language',code:lang.languageClass,name:lang.name}],
      explanation: `${lang.languageClass} = ${lang.name} language; the title specifies grammar.`
    }, 'Medium');

    if (isPhonetics) return makeResult(original, {
      udc: `${lang.languageClass}.1`, mainClass: '811', subject: `${lang.name} phonetics / phonology`, subSubject: 'Phonetics / phonology',
      aux: [{type:'language',code:lang.languageClass,name:lang.name}],
      explanation: `${lang.languageClass} = ${lang.name} language; .1 represents the phonetic/phonological subdivision in this local rule set.`
    }, 'Medium');

    if (has(t,'language') || has(t,'linguistics') || has(t,'philology')) return makeResult(original, {
      udc: lang.languageClass, mainClass:'811', subject:`${lang.name} language`, subSubject:'Language / linguistics',
      aux:[{type:'language',code:lang.languageClass,name:lang.name}],
      explanation:`${lang.languageClass} = ${lang.name} language. This is a language subject class, not the generic 0 fallback.`
    }, 'High');
  }

  // 5. Subject + form/place. Long/specific patterns are listed before broad ones.
  const subjects = [...(RULES.subjects || [])].sort((a,b) => (b.patterns?.join(' ').length||0) - (a.patterns?.join(' ').length||0));
  const sr = subjects.find(x => matchPatterns(t, x.patterns));
  if (sr) {
    let udc = sr.udc;
    const aux = [];
    const form = (RULES.forms || []).find(x => matchPatterns(t, x.patterns));
    if (form) { udc += form.code; aux.push({type:'form',code:form.code,name:form.name}); }

    const place = foundPlaces[0];
    if (place && !relationWords.some(w => has(t,w))) { udc += place.code; aux.push({type:'place',code:place.code,name:place.name}); }

    return makeResult(original, {
      ...sr, udc, mainClass: sr.mainClass || sr.udc, aux,
      explanation: sr.explanation + (aux.length ? ` Added notation: ${aux.map(x=>x.code).join(' ')}.` : '')
    }, form || place ? 'Medium' : 'High');
  }

  // Never claim an unknown title is a verified class 0 answer.
  return makeResult(original, {
    udc:'0', mainClass:'0', subject:'No sufficiently specific UDC match', subSubject:'Review required',
    explanation:'No sufficiently specific local rule matched this title. 0 is not being presented as a verified subject answer. Check the authoritative UDC Summary/UDC Online or licensed MRF for the exact title.'
  }, 'Low');
}

app.get('/health', (req,res) => res.json({ok:true, service:'UDC Classifier', version:'FINAL-MASTER-FIX-V4'}));
app.get('/', (req,res) => res.sendFile(path.join(__dirname,'index.html')));
for (const endpoint of ['/api/classify','/classify']) {
  app.post(endpoint, (req,res) => {
    try {
      const title = req.body?.title ?? req.body?.bookTitle ?? req.body?.query ?? '';
      res.json(classify(title));
    } catch (e) {
      res.status(500).json({error:'Classification failed',message:e.message});
    }
  });
}
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`UDC Final Master Fix V4 listening on ${PORT}`));
