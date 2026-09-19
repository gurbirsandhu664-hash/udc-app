const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve the UDC web app from the same Render Web Service.
app.use(express.static(__dirname));

const rules = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'udc-rules.json'), 'utf8')
);

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9=:.()\-+\/\" ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function has(t, p) {
  return t.includes(p);
}

function firstMatch(t, arr) {
  return Array.isArray(arr) ? arr.find(x => has(t, x.pattern)) : undefined;
}

function result(title, r, confidence = 'High') {
  return {
    title,
    bookTitle: title,
    udc: r.udc,
    finalUdcNumber: r.udc,
    proposedUdcNumber: r.udc,
    mainClass: r.mainClass || String(r.udc || '').split(/[.(=\"\-+/:]/)[0],
    subject: r.subject || '',
    mainSubject: r.subject || '',
    subSubject: r.subSubject || '',
    confidence: r.confidence || confidence,
    explanation: r.explanation || `UDC ${r.udc}: ${r.subject || ''}.`,
    cataloguerExplanation:
      r.cataloguerExplanation ||
      r.explanation ||
      `UDC ${r.udc}: ${r.subject || ''}.`,
    alternatives: r.alternatives || [],
    aux: r.aux || [],
    verifiedRule: r.verifiedRule !== false,
    source: r.source || 'local UDC rule set'
  };
}

function classify(rawTitle) {
  const title = String(rawTitle || '').trim();
  const t = norm(title);

  if (!t) {
    return result(
      '',
      {
        udc: '0',
        subject: 'Science and knowledge',
        subSubject: 'General works',
        explanation: '0 — Science and knowledge.'
      },
      'Low'
    );
  }

  /*
   * 1) EXACT COMPOUND / COORDINATED SUBJECT RULES
   *
   * These must run BEFORE the generic exact-answer-key lookup.
   * Otherwise a broad single-subject rule such as "arts" can incorrectly
   * capture a title containing two coordinated subjects.
   *
   * UDC "+" is the coordination sign for two or more equally important
   * subjects.
   */

  // Science + Arts
  if (
    t === 'science and arts' ||
    t === 'science arts' ||
    t === 'science + arts'
  ) {
    return result(title, {
      udc: '5+7',
      mainClass: '5+7',
      subject: 'Science and Arts',
      subSubject: 'Mathematics and Natural Sciences + The Arts',
      aux: [
        {
          type: 'subject',
          code: '5',
          name: 'Mathematics and Natural Sciences'
        },
        {
          type: 'relation',
          code: '+',
          name: 'Coordination'
        },
        {
          type: 'subject',
          code: '7',
          name: 'The Arts'
        }
      ],
      explanation:
        '5 = Mathematics and Natural Sciences; + = coordination of equally important subjects; 7 = The Arts. The title presents Science and Arts as two coordinated subjects.'
    });
  }

  // Science + Technology
  if (
    t === 'science and technology' ||
    t === 'science technology' ||
    t === 'science + technology'
  ) {
    return result(title, {
      udc: '5+6',
      mainClass: '5+6',
      subject: 'Science and Technology',
      subSubject: 'Mathematics and Natural Sciences + Applied Sciences, Medicine and Technology',
      aux: [
        {
          type: 'subject',
          code: '5',
          name: 'Mathematics and Natural Sciences'
        },
        {
          type: 'relation',
          code: '+',
          name: 'Coordination'
        },
        {
          type: 'subject',
          code: '6',
          name: 'Applied Sciences, Medicine and Technology'
        }
      ],
      explanation:
        '5 = Mathematics and Natural Sciences; + = coordination; 6 = Applied Sciences, Medicine and Technology.'
    });
  }

  // Arts + Humanities
  if (
    t === 'arts and humanities' ||
    t === 'arts humanities' ||
    t === 'arts + humanities'
  ) {
    return result(title, {
      udc: '7+9',
      mainClass: '7+9',
      subject: 'Arts and Humanities',
      subSubject: 'The Arts + Geography, Biography and History',
      aux: [
        { type: 'subject', code: '7', name: 'The Arts' },
        { type: 'relation', code: '+', name: 'Coordination' },
        {
          type: 'subject',
          code: '9',
          name: 'Geography, Biography and History'
        }
      ],
      explanation:
        '7 = The Arts; + = coordination; 9 = Geography, Biography and History.'
    });
  }

  /*
   * 2) HIGH-PRIORITY INTERNATIONAL RELATIONS BETWEEN NAMED COUNTRIES.
   */
  const countries = rules.countries || {};
  const found = Object.entries(countries).filter(([k]) => has(t, k));

  const relationWords = [
    'relation',
    'relations',
    'relationship',
    'relationships',
    'foreign relation',
    'foreign relations',
    'diplomatic',
    'diplomacy',
    'bilateral',
    'international relation',
    'international relations',
    'foreign policy',
    'foreign affairs',
    'cooperation',
    'conflict',
    'ties between'
  ];

  if (found.length >= 2 && relationWords.some(w => has(t, w))) {
    const a = found[0][1];
    const b = found[1][1];
    const udc = `327(${a.code}:${b.code})`;

    return result(title, {
      udc,
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

  /*
   * 3) EXACT TITLE RULES FROM THE SUPPLIED LOCAL ANSWER KEY.
   *
   * These remain high priority for titles that have an explicit exact rule,
   * but they no longer override the compound rules above.
   */
  const exactRules = Array.isArray(rules.exact) ? rules.exact : [];
  const exact = exactRules.find(x => t === norm(x.pattern));

  if (exact) {
    return result(title, exact, exact.confidence || 'High');
  }

  /*
   * 4) LANGUAGE / LITERATURE.
   *
   * Literary form is detected before generic language so that
   * "English drama", "English poetry", etc. are not reduced to a
   * generic language class.
   */
  const languages = Array.isArray(rules.languages) ? rules.languages : [];
  const lang = firstMatch(t, languages);

  if (lang) {
    // Language dictionary / lexicon / glossary
    if (
      has(t, 'dictionary') ||
      has(t, 'lexicon') ||
      has(t, 'glossary')
    ) {
      const base = lang.languageClass || lang.code;

      return result(title, {
        udc: `${base}(038)`,
        mainClass: '8',
        subject: `${lang.name} language — dictionary / lexicon`,
        subSubject: 'Dictionary',
        aux: [
          {
            type: 'language',
            code: lang.code,
            name: lang.name
          },
          {
            type: 'form',
            code: '(038)',
            name: 'Dictionary'
          }
        ],
        explanation:
          `${base} = ${lang.name} language; (038) = dictionary/form auxiliary.`
      });
    }

    // Grammar
    if (has(t, 'grammar')) {
      return result(
        title,
        {
          udc: `${lang.languageClass || lang.code}5`,
          mainClass: '8',
          subject: `${lang.name} grammar`,
          subSubject: 'Grammar',
          explanation:
            `Language class for ${lang.name}, with the grammar subdivision. ` +
            'Verify the exact subdivision against the licensed UDC schedule.'
        },
        'Medium'
      );
    }

    // Phonetics / phonology
    if (has(t, 'phonetics') || has(t, 'phonology')) {
      return result(
        title,
        {
          udc: `${lang.languageClass || lang.code}1`,
          mainClass: '8',
          subject: `${lang.name} phonetics / phonology`,
          subSubject: 'Phonetics / phonology',
          explanation:
            `Language class for ${lang.name}, with the linguistic subdivision.`
        },
        'Medium'
      );
    }

    // Literature and literary forms
    if (
      has(t, 'literature') ||
      has(t, 'poetry') ||
      has(t, 'poem') ||
      has(t, 'drama') ||
      has(t, 'play') ||
      has(t, 'fiction') ||
      has(t, 'novel') ||
      has(t, 'short stories') ||
      has(t, 'short story')
    ) {
      let form = '';

      if (has(t, 'drama') || has(t, 'play')) {
        form = '-2';
      } else if (has(t, 'poetry') || has(t, 'poem')) {
        form = '-1';
      } else if (
        has(t, 'fiction') ||
        has(t, 'novel') ||
        has(t, 'short stor')
      ) {
        form = '-3';
      }

      const udc = `${lang.litCode || lang.code}${form}`;

      return result(title, {
        udc,
        mainClass: '821',
        subject:
          `${lang.name} literature` +
          (form === '-2'
            ? ' — drama'
            : form === '-1'
              ? ' — poetry'
              : form === '-3'
                ? ' — fiction'
                : ''),
        subSubject:
          form === '-2'
            ? 'Drama'
            : form === '-1'
              ? 'Poetry'
              : form === '-3'
                ? 'Fiction'
                : 'Literature',
        aux: [
          {
            type: 'language',
            code: lang.code,
            name: lang.name
          }
        ],
        explanation:
          `${lang.litCode || lang.code} = literature in ${lang.name}; ` +
          `${form || 'general literature'} identifies the literary form.`
      });
    }

    // Generic language / linguistics
    if (
      has(t, 'language') ||
      has(t, 'linguistics') ||
      has(t, 'philology')
    ) {
      return result(
        title,
        {
          udc: lang.languageClass || lang.code,
          mainClass: '81',
          subject: `${lang.name} language`,
          subSubject: 'Language / linguistics',
          aux: [
            {
              type: 'language',
              code: lang.code,
              name: lang.name
            }
          ],
          explanation:
            `Language class for ${lang.name}. The language auxiliary identifies ` +
            'the language of a work; the linguistic subject itself belongs in ' +
            '81/811 according to the schedule.'
        },
        'Medium'
      );
    }
  }

  /*
   * 5) GENERIC SUBJECT + FORM.
   *
   * Subject is selected first. Form auxiliaries are then appended.
   */
  const forms = Array.isArray(rules.forms) ? rules.forms : [];
  const subjects = Array.isArray(rules.subjects) ? rules.subjects : [];

  const form = firstMatch(t, forms);
  const subjectRule = firstMatch(t, subjects);

  if (subjectRule) {
    let udc = subjectRule.udc;
    const aux = [];
    let explanation = subjectRule.explanation || '';

    if (
      has(t, 'dictionary') ||
      has(t, 'lexicon') ||
      has(t, 'glossary')
    ) {
      udc += '(038)';
      aux.push({
        type: 'form',
        code: '(038)',
        name: 'Dictionary'
      });
    } else if (
      has(t, 'encyclopedia') ||
      has(t, 'encyclopaedia')
    ) {
      udc += '(03)';
      aux.push({
        type: 'form',
        code: '(03)',
        name: 'Encyclopaedia / reference work'
      });
    } else if (has(t, 'handbook') || has(t, 'manual')) {
      udc += '(035)';
      aux.push({
        type: 'form',
        code: '(035)',
        name: 'Handbook / manual'
      });
    } else if (has(t, 'textbook')) {
      udc += '(075)';
      aux.push({
        type: 'form',
        code: '(075)',
        name: 'Textbook'
      });
    }

    const places = Array.isArray(rules.places) ? rules.places : [];
    const place = firstMatch(t, places);

    if (
      place &&
      !/relation|relations|foreign|diplomatic/.test(t)
    ) {
      udc += place.code;
      aux.push({
        type: 'place',
        code: place.code,
        name: place.name
      });
    }

    if (aux.length) {
      explanation +=
        ` Form/place auxiliaries detected: ${aux
          .map(a => a.code)
          .join(' ')}.`;
    }

    return result(title, {
      udc,
      mainClass: subjectRule.udc,
      subject: subjectRule.subject,
      subSubject: subjectRule.subSubject || '',
      aux,
      explanation
    });
  }

  /*
   * 6) FORM-ONLY FALLBACK.
   */
  if (form) {
    return result(
      title,
      {
        udc: `0${form.code}`,
        mainClass: '0',
        subject: 'General work',
        subSubject: form.name,
        aux: [
          {
            type: 'form',
            code: form.code,
            name: form.name
          }
        ],
        explanation:
          `${form.code} = ${form.name} form auxiliary. The subject must ` +
          'determine the main UDC class before the form auxiliary is added.'
      },
      'Low'
    );
  }

  /*
   * 7) GENERAL FALLBACK.
   */
  return result(
    title,
    {
      udc: '0',
      mainClass: '0',
      subject: 'Science and knowledge',
      subSubject: 'General works',
      explanation:
        'No sufficiently specific local rule matched the title. ' +
        '0 is the general class for science and knowledge; verify the ' +
        'authoritative UDC schedule for exact cataloguing.'
    },
    'Low'
  );
}

app.get('/health', (req, res) =>
  res.json({
    ok: true,
    service: 'UDC Classifier',
    version: 'final-fixed-2026-09'
  })
);

app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'index.html'))
);

app.post('/api/classify', (req, res) => {
  try {
    const title =
      req.body?.title ??
      req.body?.bookTitle ??
      req.body?.query ??
      '';

    return res.json(classify(title));
  } catch (e) {
    return res.status(500).json({
      error: 'Classification failed',
      message: e.message
    });
  }
});

app.post('/classify', (req, res) => {
  try {
    const title =
      req.body?.title ??
      req.body?.bookTitle ??
      req.body?.query ??
      '';

    return res.json(classify(title));
  } catch (e) {
    return res.status(500).json({
      error: 'Classification failed',
      message: e.message
    });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () =>
  console.log(`UDC classifier listening on ${PORT}`)
);
