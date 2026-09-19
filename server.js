const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

/*
 FINAL UDC CLASSIFIER SERVER
 ---------------------------
 - package.json is not required to change
 - keeps the existing udc-rules.json as the main local rule source
 - adds high-priority UDC rules for common titles
 - prevents known titles from falling to 0
 - uses UDC notation (+, :, auxiliaries) only where supported by the
   local/explicit rule
 NOTE: this is NOT a replacement for a licensed complete UDC schedule.
*/

const rulesPath = path.join(__dirname, 'udc-rules.json');
let rules = {
  exact: [],
  countries: {},
  languages: [],
  forms: [],
  subjects: [],
  places: []
};

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
  console.error('udc-rules.json load error:', e.message);
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9=:.()\-+\/"& ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function has(t, p) {
  return t.includes(p);
}

function firstMatch(t, arr) {
  return Array.isArray(arr) ? arr.find(x => x && x.pattern && has(t, norm(x.pattern))) : undefined;
}

function makeResult(title, r, confidence = 'High') {
  const udc = r.udc || '0';
  return {
    title,
    bookTitle: title,
    udc,
    finalUdcNumber: udc,
    proposedUdcNumber: udc,
    mainClass: r.mainClass || String(udc).split(/[.(="'\-+/:]/)[0],
    subject: r.subject || '',
    mainSubject: r.mainSubject || r.subject || '',
    subSubject: r.subSubject || '',
    confidence,
    explanation: r.explanation || `UDC ${udc}: ${r.subject || ''}.`,
    cataloguerExplanation: r.explanation || `UDC ${udc}: ${r.subject || ''}.`,
    alternatives: r.alternatives || [],
    aux: r.aux || [],
    verifiedRule: r.verifiedRule === true,
    source: r.source || 'UDC local rule set'
  };
}

function exactTitle(title, udc, mainClass, subject, subSubject, explanation, aux = []) {
  return makeResult(title, {
    udc, mainClass, subject, subSubject, aux, explanation
  }, 'High');
}

/*
 ============================================================
 HIGH PRIORITY / FIXED COMMON UDC TITLES
 ============================================================
*/
function fixedRules(title, t) {

  // --- General coordinated subjects ---
  if (t === 'science and technology' || t === 'science technology') {
    return exactTitle(
      title, '5/6', '5/6', 'Science and Technology',
      'Mathematics and natural sciences + Applied sciences, medicine and technology',
      '5/6 = extension from class 5 to class 6; 5 covers mathematics and natural sciences and 6 covers applied sciences, medicine and technology.',
      [
        { type: 'main-class', code: '5', name: 'Mathematics and natural sciences' },
        { type: 'relation', code: '/', name: 'Extension' },
        { type: 'main-class', code: '6', name: 'Applied sciences, medicine and technology' }
      ]
    );
  }

  if (
    t === 'science and arts' ||
    t === 'science arts' ||
    t === 'science & arts'
  ) {
    return exactTitle(
      title, '5+7', '5+7', 'Science and Arts',
      'Mathematics and natural sciences + The arts',
      '5 = Mathematics and natural sciences; + = coordination of equally important subjects; 7 = The arts.',
      [
        { type: 'main-class', code: '5', name: 'Mathematics and natural sciences' },
        { type: 'relation', code: '+', name: 'Coordination' },
        { type: 'main-class', code: '7', name: 'The arts' }
      ]
    );
  }

  // --- Languages: Hindi ---
  if (t === 'hindi' || t === 'hindi language') {
    return exactTitle(
      title, '811.214.21', '811',
      'Hindi language',
      'Modern Indic language — Hindi',
      '811.214.21 = Hindi language; 811 = individual languages within the linguistics/language class.',
      []
    );
  }

  if (t === 'hindi literature') {
    return exactTitle(
      title, '821.214.21', '821',
      'Hindi literature',
      'Literature in Hindi',
      '821.214.21 = Hindi literature; 821 = literatures of individual languages.',
      []
    );
  }

  if (t === 'english language') {
    return exactTitle(
      title, '811.111', '811',
      'English language',
      'English language',
      '811.111 = English language in the UDC language schedule.',
      []
    );
  }

  if (t === 'english literature') {
    return exactTitle(
      title, '821.111', '821',
      'English literature',
      'Literature in English',
      '821.111 = English literature.',
      []
    );
  }

  if (t === 'punjabi language') {
    return exactTitle(
      title, '811.214.27', '811',
      'Punjabi language',
      'Modern Indic language — Punjabi',
      '811.214.27 = Punjabi language.',
      []
    );
  }

  if (t === 'punjabi literature') {
    return exactTitle(
      title, '821.214.27', '821',
      'Punjabi literature',
      'Literature in Punjabi',
      '821.214.27 = Punjabi literature.',
      []
    );
  }

  // --- India ---
  if (t === 'history of india' || t === 'indian history') {
    return exactTitle(
      title, '94(540)', '94',
      'History of India',
      'General history — India',
      '94 = General history; (540) = India. Combined notation: 94(540).',
      [{ type: 'place', code: '(540)', name: 'India' }]
    );
  }

  if (t === 'geography of india' || t === 'indian geography') {
    return exactTitle(
      title, '91(540)', '91',
      'Geography of India',
      'Geography — India',
      '91 = Geography; (540) = India. Combined notation: 91(540).',
      [{ type: 'place', code: '(540)', name: 'India' }]
    );
  }

  if (t === 'indian constitution' || t === 'constitution of india') {
    return exactTitle(
      title, '342(540)', '342',
      'Constitution of India',
      'Constitutional law — India',
      '342 = Constitutional law; (540) = India. Combined notation: 342(540).',
      [{ type: 'place', code: '(540)', name: 'India' }]
    );
  }

  if (t === 'economy of india' || t === 'indian economy') {
    return exactTitle(
      title, '330(540)', '330',
      'Economy of India',
      'Economics — India',
      '330 = Economics; (540) = India. Combined notation: 330(540).',
      [{ type: 'place', code: '(540)', name: 'India' }]
    );
  }

  if (t === 'indian philosophy') {
    return exactTitle(
      title, '1(540)', '1',
      'Indian philosophy',
      'Philosophy — India',
      '1 = Philosophy; (540) = India. Combined notation: 1(540).',
      [{ type: 'place', code: '(540)', name: 'India' }]
    );
  }

  if (t === 'indian art') {
    return exactTitle(
      title, '7(540)', '7',
      'Indian art',
      'The arts — India',
      '7 = The arts; (540) = India. Combined notation: 7(540).',
      [{ type: 'place', code: '(540)', name: 'India' }]
    );
  }

  // --- Common general titles ---
  if (t === 'science') {
    return exactTitle(
      title, '5', '5',
      'Mathematics and natural sciences',
      'General',
      '5 = Mathematics and natural sciences.'
    );
  }

  if (t === 'arts' || t === 'the arts') {
    return exactTitle(
      title, '7', '7',
      'The arts',
      'General',
      '7 = The arts.'
    );
  }

  if (t === 'mathematics') {
    return exactTitle(
      title, '51', '51',
      'Mathematics',
      'General mathematics',
      '51 = Mathematics.'
    );
  }

  if (t === 'physics') {
    return exactTitle(
      title, '53', '53',
      'Physics',
      'General physics',
      '53 = Physics.'
    );
  }

  if (t === 'chemistry') {
    return exactTitle(
      title, '54', '54',
      'Chemistry',
      'General chemistry',
      '54 = Chemistry.'
    );
  }

  if (t === 'biology') {
    return exactTitle(
      title, '57', '57',
      'Biological sciences',
      'Biology',
      '57 = Biological sciences.'
    );
  }

  if (t === 'computer science' || t === 'computing') {
    return exactTitle(
      title, '004', '004',
      'Computer science and technology',
      'Computing',
      '004 = Computer science and technology. Computing. Data processing.'
    );
  }

  if (t === 'medicine' || t === 'medical science') {
    return exactTitle(
      title, '61', '61',
      'Medical sciences',
      'Medicine',
      '61 = Medical sciences.'
    );
  }

  if (t === 'education') {
    return exactTitle(
      title, '37', '37',
      'Education',
      'Education and teaching',
      '37 = Education.'
    );
  }

  if (t === 'religion' || t === 'theology') {
    return exactTitle(
      title, '2', '2',
      'Religion. Theology',
      'General religion',
      '2 = Religion. Theology.'
    );
  }

  if (t === 'philosophy') {
    return exactTitle(
      title, '1', '1',
      'Philosophy',
      'General philosophy',
      '1 = Philosophy.'
    );
  }

  if (t === 'psychology') {
    return exactTitle(
      title, '159.9', '159.9',
      'Psychology',
      'General psychology',
      '159.9 = Psychology.'
    );
  }

  if (t === 'politics' || t === 'political science') {
    return exactTitle(
      title, '32', '32',
      'Politics',
      'Political science',
      '32 = Politics.'
    );
  }

  if (t === 'economics' || t === 'economy') {
    return exactTitle(
      title, '33', '33',
      'Economics',
      'General economics',
      '33 = Economics.'
    );
  }

  if (t === 'sociology') {
    return exactTitle(
      title, '316', '316',
      'Sociology',
      'General sociology',
      '316 = Sociology.'
    );
  }

  if (t === 'statistics') {
    return exactTitle(
      title, '311', '311',
      'Statistics as a science',
      'Statistical theory',
      '311 = Statistics as a science. Statistical theory.'
    );
  }

  if (t === 'geography') {
    return exactTitle(
      title, '91', '91',
      'Geography',
      'General geography',
      '91 = Geography.'
    );
  }

  if (t === 'history') {
    return exactTitle(
      title, '94', '94',
      'History',
      'General history',
      '94 = General history.'
    );
  }

  /*
   ============================================================
   COMMON FORM TITLES
   These are applied after the subject is identified.
   ============================================================
  */

  return null;
}

function applySubjectAndForm(title, t) {
  const subjectRule = firstMatch(t, rules.subjects || []);
  if (!subjectRule) return null;

  let udc = subjectRule.udc;
  const aux = [];
  let explanation = subjectRule.explanation || `UDC ${udc}: ${subjectRule.subject || ''}.`;

  if (has(t, 'dictionary') || has(t, 'lexicon') || has(t, 'glossary')) {
    udc += '(038)';
    aux.push({ type: 'form', code: '(038)', name: 'Dictionary' });
  } else if (has(t, 'encyclopedia') || has(t, 'encyclopaedia')) {
    udc += '(03)';
    aux.push({ type: 'form', code: '(03)', name: 'Encyclopaedia / reference work' });
  } else if (has(t, 'handbook') || has(t, 'manual')) {
    udc += '(035)';
    aux.push({ type: 'form', code: '(035)', name: 'Handbook / manual' });
  } else if (has(t, 'textbook')) {
    udc += '(075)';
    aux.push({ type: 'form', code: '(075)', name: 'Textbook' });
  }

  const place = firstMatch(t, rules.places || []);
  if (place && !/relation|relations|foreign|diplomatic/.test(t)) {
    udc += place.code;
    aux.push({ type: 'place', code: place.code, name: place.name });
  }

  return makeResult(title, {
    udc,
    mainClass: subjectRule.udc,
    subject: subjectRule.subject,
    subSubject: subjectRule.subSubject || '',
    aux,
    explanation:
      explanation +
      (aux.length
        ? ` Form/place auxiliaries: ${aux.map(a => a.code).join(' ')}.`
        : '')
  });
}

function classify(rawTitle) {
  const title = String(rawTitle || '').trim();
  const t = norm(title);

  if (!t) {
    return makeResult('', {
      udc: '0',
      mainClass: '0',
      subject: 'Science and knowledge',
      subSubject: 'General works',
      explanation: '0 = Science and knowledge. Enter a title for a specific classification.'
    }, 'Low');
  }

  // 1. Fixed/high-priority rules.
  const fixed = fixedRules(title, t);
  if (fixed) return fixed;

  // 2. Normalized compound-title alias that must not fall to 0.
  if (/^science\s*(and|&)\s*technology$/.test(t)) {
    return makeResult(title, {
      udc: '5/6', mainClass: '5/6', subject: 'Science and technology',
      subSubject: 'Mathematics and natural sciences through technology and applied sciences',
      aux: [
        {type:'main-class', code:'5', name:'Mathematics and natural sciences'},
        {type:'relation', code:'/', name:'Extension'},
        {type:'main-class', code:'6', name:'Applied sciences. Medicine. Technology'}
      ],
      explanation: '5/6 uses the UDC extension sign / to express the range from class 5 to class 6.',
      verifiedRule: true, source: 'UDC Summary notation'
    }, 'High');
  }

  // 2. Existing exact answer-key rules.
  const exact = (rules.exact || []).find(x => x && t === norm(x.pattern));
  if (exact) return makeResult(title, exact, exact.confidence || 'High');

  // 3. International relations between two named places.
  const countries = rules.countries || {};
  const found = Object.entries(countries).filter(([k]) => has(t, norm(k)));
  const relationWords = [
    'relation', 'relations', 'relationship', 'relationships',
    'foreign relation', 'foreign relations', 'diplomatic',
    'diplomacy', 'bilateral', 'international relation',
    'international relations', 'foreign policy', 'foreign affairs',
    'cooperation', 'conflict', 'ties between'
  ];

  if (found.length >= 2 && relationWords.some(w => has(t, w))) {
    const a = found[0][1], b = found[1][1];
    return makeResult(title, {
      udc: `327(${a.code}:${b.code})`,
      mainClass: '327',
      subject: `${a.name}–${b.name} international relations`,
      subSubject: 'Foreign / international relations',
      aux: [
        { type: 'place', code: a.code, name: a.name },
        { type: 'relation', code: ':', name: 'Relation' },
        { type: 'place', code: b.code, name: b.name }
      ],
      explanation:
        `327 = international/foreign relations; ${a.code} = ${a.name}; ` +
        `${b.code} = ${b.name}; : expresses the relation between the two places.`
    });
  }

  // 4. Language/literature rules from the local UDC dataset.
  const lang = firstMatch(t, rules.languages || []);
  if (lang) {
    if (has(t, 'dictionary') || has(t, 'lexicon') || has(t, 'glossary')) {
      const base = lang.languageClass || lang.code;
      return makeResult(title, {
        udc: `${base}(038)`,
        mainClass: '8',
        subject: `${lang.name} language — dictionary / lexicon`,
        subSubject: 'Dictionary',
        aux: [
          { type: 'language', code: lang.code, name: lang.name },
          { type: 'form', code: '(038)', name: 'Dictionary' }
        ],
        explanation:
          `${base} = ${lang.name} language; (038) = dictionary/form auxiliary.`
      });
    }

    if (has(t, 'grammar')) {
      return makeResult(title, {
        udc: `${lang.languageClass || lang.code}5`,
        mainClass: '8',
        subject: `${lang.name} grammar`,
        subSubject: 'Grammar',
        explanation:
          `Language class for ${lang.name}, with the grammar subdivision. ` +
          'Check the licensed/current UDC schedule for the exact subdivision.'
      }, 'Medium');
    }

    if (has(t, 'phonetics') || has(t, 'phonology')) {
      return makeResult(title, {
        udc: `${lang.languageClass || lang.code}1`,
        mainClass: '8',
        subject: `${lang.name} phonetics / phonology`,
        subSubject: 'Phonetics / phonology',
        explanation:
          `Language class for ${lang.name}, with the linguistic subdivision.`
      }, 'Medium');
    }

    if (
      has(t, 'literature') || has(t, 'poetry') || has(t, 'poem') ||
      has(t, 'drama') || has(t, 'play') || has(t, 'fiction') ||
      has(t, 'novel') || has(t, 'short story') || has(t, 'short stories')
    ) {
      let form = '';
      if (has(t, 'drama') || has(t, 'play')) form = '-2';
      else if (has(t, 'poetry') || has(t, 'poem')) form = '-1';
      else if (has(t, 'fiction') || has(t, 'novel') || has(t, 'short stor')) form = '-3';

      return makeResult(title, {
        udc: `${lang.litCode || lang.code}${form}`,
        mainClass: '821',
        subject:
          `${lang.name} literature` +
          (form === '-2' ? ' — drama' :
           form === '-1' ? ' — poetry' :
           form === '-3' ? ' — fiction' : ''),
        subSubject:
          form === '-2' ? 'Drama' :
          form === '-1' ? 'Poetry' :
          form === '-3' ? 'Fiction' : 'Literature',
        aux: [{ type: 'language', code: lang.code, name: lang.name }],
        explanation:
          `${lang.litCode || lang.code} = literature in ${lang.name}; ` +
          `${form || 'general literature'} identifies the literary form.`
      });
    }

    if (has(t, 'language') || has(t, 'linguistics') || has(t, 'philology')) {
      return makeResult(title, {
        udc: lang.languageClass || lang.code,
        mainClass: '81',
        subject: `${lang.name} language`,
        subSubject: 'Language / linguistics',
        aux: [{ type: 'language', code: lang.code, name: lang.name }],
        explanation:
          `Language class for ${lang.name}. Use the current UDC schedule to verify the exact subdivision.`
      }, 'Medium');
    }
  }

  // 5. Subject + form + place using the user's existing rule database.
  const combined = applySubjectAndForm(title, t);
  if (combined) return combined;

  // 6. Form alone should not invent a false subject number.
  const form = firstMatch(t, rules.forms || []);
  if (form) {
    return makeResult(title, {
      udc: '0',
      mainClass: '0',
      subject: 'Unresolved subject — form detected',
      subSubject: form.name || 'General work',
      aux: [{ type: 'form', code: form.code, name: form.name }],
      explanation:
        `${form.code} = ${form.name} form auxiliary was detected, but the title does not provide enough subject information for a reliable main UDC number.`
    }, 'Low');
  }

  // 7. Honest fallback. Never label an unresolved 0 as a verified classification.
  return makeResult(title, {
    udc: '0',
    mainClass: '0',
    subject: 'Unresolved title',
    subSubject: 'No sufficiently specific local UDC rule matched',
    explanation:
      'No sufficiently specific local rule matched this title. 0 is a fallback only, not a verified subject classification.',
    verifiedRule: false,
    source: 'UDC fallback'
  }, 'Low');
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'UDC Classifier',
    version: 'final-udc-summary-oriented-2026-09',
    rulesLoaded: {
      exact: rules.exact.length,
      languages: rules.languages.length,
      subjects: rules.subjects.length,
      places: rules.places.length,
      forms: rules.forms.length
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

function handleClassify(req, res) {
  try {
    const title =
      req.body?.title ??
      req.body?.bookTitle ??
      req.body?.query ??
      '';
    return res.json(classify(title));
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      error: 'Classification failed',
      message: e.message
    });
  }
}

app.post('/api/classify', handleClassify);
app.post('/classify', handleClassify);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`UDC classifier listening on ${PORT}`);
});
