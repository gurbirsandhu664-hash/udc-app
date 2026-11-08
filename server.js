import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// 1. CONFIGURATION
// ============================================================================
const ANNIF_API_URL = process.env.ANNIF_API_URL || 'https://api.annif.org/v1';
const ANNIF_PROJECT = process.env.ANNIF_PROJECT || 'udc-project';
const WORLDSHARE_WSKEY = process.env.WORLDCAT_API_KEY || process.env.WORLDSHARE_WSKEY || '';
const WORLDSHARE_AI_URL = process.env.WORLDSHARE_AI_URL || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ਕਲਾਸੀਫਿਕੇਸ਼ਨ ਨੰਬਰ ਦੀ ਪੁਸ਼ਟੀ (ਸਿਰਫ਼ ਅੰਕ ਤੇ ਚਿੰਨ੍ਹ ਹੋਣ, ਸਾਦਾ ਅੰਗਰੇਜ਼ੀ ਟੈਕਸਟ ਨਾ ਹੋਵੇ)
function isValidNotation(val) {
  if (!val || typeof val !== 'string') return false;
  const s = val.trim();
  return /^[0-9]+[0-9/:\(\)\.\+=\-A-Z\s]*$/.test(s) && /\d/.test(s);
}

// ============================================================================
// 2. HIGH-PRECISION MULTI-FACET SYNTHESIZER
// ============================================================================
function synthesizeFacets(title) {
  const t = norm(title);

  // 1. Geography / Place Auxiliaries ((...)) & DDC Area (Table 2)
  let placeUdc = '';
  let placeDdc = '';
  let placeName = '';
  if (/\b(india|indian|bharat|hindustan)\b/i.test(t)) {
    placeUdc = '(540)';
    placeDdc = '54';
    placeName = 'India';
  } else if (/\b(punjab)\b/i.test(t)) {
    placeUdc = '(540.15)';
    placeDdc = '54552';
    placeName = 'Punjab';
  } else if (/\b(united states|usa|us|america|american)\b/i.test(t)) {
    placeUdc = '(73)';
    placeDdc = '73';
    placeName = 'United States';
  } else if (/\b(united kingdom|uk|britain|british|england)\b/i.test(t)) {
    placeUdc = '(410)';
    placeDdc = '41';
    placeName = 'United Kingdom';
  } else if (/\b(pakistan|pakistani)\b/i.test(t)) {
    placeUdc = '(549.1)';
    placeDdc = '5491';
    placeName = 'Pakistan';
  } else if (/\b(europe|european)\b/i.test(t)) {
    placeUdc = '(4)';
    placeDdc = '4';
    placeName = 'Europe';
  } else if (/\b(germany|german)\b/i.test(t)) {
    placeUdc = '(430)';
    placeDdc = '43';
    placeName = 'Germany';
  }

  // 2. Language Auxiliaries (=...)
  let langUdc = '';
  let langName = '';
  if (/\b(in english|english language)\b/i.test(t)) { langUdc = '=111'; langName = 'English'; }
  else if (/\b(in punjabi|punjabi language)\b/i.test(t)) { langUdc = '=214.27'; langName = 'Punjabi'; }
  else if (/\b(in hindi|hindi language)\b/i.test(t)) { langUdc = '=214.21'; langName = 'Hindi'; }
  else if (/\b(in urdu|urdu language)\b/i.test(t)) { langUdc = '=214.22'; langName = 'Urdu'; }
  else if (/\b(in french|french language)\b/i.test(t)) { langUdc = '=133.1'; langName = 'French'; }
  else if (/\b(in german|german language)\b/i.test(t)) { langUdc = '=112.2'; langName = 'German'; }

  // 3. Form Auxiliaries ((0...))
  let formUdc = '';
  let formDdc = '';
  let formDesc = '';
  if (/\b(textbook|text book|course book|school book)\b/i.test(t)) {
    formUdc = '(075)';
    formDdc = '.071';
    formDesc = 'Textbook form (075)';
  } else if (/\b(encyclopedia|encyclopaedia|vishwakosh)\b/i.test(t)) {
    formUdc = '(031)';
    formDdc = '03';
    formDesc = 'Encyclopedia form (031)';
  } else if (/\b(dictionary|shabdakosh|glossary|lexicon)\b/i.test(t)) {
    formUdc = '(038)';
    formDdc = '03';
    formDesc = 'Dictionary form (038)';
  } else if (/\b(handbook|manual|guide)\b/i.test(t)) {
    formUdc = '(035)';
    formDdc = '.02';
    formDesc = 'Handbook/Manual form (035)';
  }

  // 4. Specific Subjects
  const subjects = [
    { regex: /\b(public librar(y|ies))\b/i, udc: '027.4', ddc: '027.4', name: 'Public libraries' },
    { regex: /\b(academic librar(y|ies)|university librar(y|ies))\b/i, udc: '027.7', ddc: '027.7', name: 'University libraries' },
    { regex: /\b(school librar(y|ies))\b/i, udc: '027.8', ddc: '027.8', name: 'School libraries' },
    { regex: /\b(national librar(y|ies))\b/i, udc: '027.5', ddc: '027.5', name: 'National libraries' },
    { regex: /\b(library classification|classification and indexing)\b/i, udc: '025.4', ddc: '025.4', name: 'Library classification' },
    { regex: /\b(library catalogu?ing)\b/i, udc: '025.3', ddc: '025.3', name: 'Library cataloguing' },
    { regex: /\b(librar(y|ies)|librarianship|library science)\b/i, udc: '02', ddc: '020', name: 'Library Science' },
    
    { regex: /\b(mathematics|maths?|algebra|calculus|geometry)\b/i, udc: '51', ddc: '510', name: 'Mathematics' },
    { regex: /\b(science|sciences|scientific)\b/i, udc: '5', ddc: '500', name: 'Pure Sciences' },
    { regex: /\b(physics|optics|thermodynamics)\b/i, udc: '53', ddc: '530', name: 'Physics' },
    { regex: /\b(chemistry|biochemistry|organic chemistry)\b/i, udc: '54', ddc: '540', name: 'Chemistry' },
    { regex: /\b(biology|biological sciences?)\b/i, udc: '57', ddc: '570', name: 'Biology' },
    { regex: /\b(botany|plants?)\b/i, udc: '58', ddc: '580', name: 'Botany' },
    { regex: /\b(zoology|animals?)\b/i, udc: '59', ddc: '590', name: 'Zoology' },
    { regex: /\b(computer science|computing|computers?|data science)\b/i, udc: '004', ddc: '004', name: 'Computer Science' },
    { regex: /\b(medicine|medical|health|anatomy)\b/i, udc: '61', ddc: '610', name: 'Medicine' },
    { regex: /\b(agriculture|farming|crops?|wheat|maize|cereals)\b/i, udc: '63', ddc: '630', name: 'Agriculture' },
    { regex: /\b(engineering|technology|mechanical|electrical)\b/i, udc: '62', ddc: '620', name: 'Engineering' },
    { regex: /\b(philosophy)\b/i, udc: '1', ddc: '100', name: 'Philosophy' },
    { regex: /\b(psychology)\b/i, udc: '159.9', ddc: '150', name: 'Psychology' },
    { regex: /\b(religion|theology|sikhism|hinduism|islam|christianity)\b/i, udc: '2', ddc: '200', name: 'Religion' },
    { regex: /\b(sociology|social sciences?)\b/i, udc: '316', ddc: '301', name: 'Sociology' },
    { regex: /\b(economics?|economy|banking|finance)\b/i, udc: '33', ddc: '330', name: 'Economics' },
    { regex: /\b(law|jurisprudence|legal system|constitution)\b/i, udc: '34', ddc: '340', name: 'Law' },
    { regex: /\b(education|pedagogy|teaching)\b/i, udc: '37', ddc: '370', name: 'Education' },
    { regex: /\b(geography|cartography)\b/i, udc: '91', ddc: '910', name: 'Geography' },
    { regex: /\b(history|historiography)\b/i, udc: '94', ddc: '900', name: 'History' },
    { regex: /\b(art|arts|painting|sculpture)\b/i, udc: '7', ddc: '700', name: 'The Arts' },
    { regex: /\b(music)\b/i, udc: '78', ddc: '780', name: 'Music' },
    { regex: /\b(literature|poetry|drama|fiction)\b/i, udc: '82', ddc: '800', name: 'Literature' }
  ];

  for (const s of subjects) {
    if (s.regex.test(t)) {
      const fullUdc = `${s.udc}${placeUdc}${formUdc}${langUdc}`;
      
      let fullDdc = s.ddc;
      if (placeDdc) {
        if (fullDdc.includes('.')) {
          fullDdc = fullDdc + placeDdc;
        } else if (fullDdc.endsWith('00')) {
          fullDdc = fullDdc.charAt(0) + placeDdc;
        } else if (fullDdc.endsWith('0')) {
          fullDdc = fullDdc.slice(0, 2) + placeDdc;
        } else {
          fullDdc = fullDdc + '.' + placeDdc;
        }
      } else if (formDdc) {
        if (formDdc === '03' && fullDdc.endsWith('00')) {
          fullDdc = fullDdc.charAt(0) + '03';
        } else {
          fullDdc = fullDdc + formDdc;
        }
      }

      const breakdownParts = [`${s.udc} = ${s.name}`];
      if (placeName) breakdownParts.push(`Place auxiliary: ${placeUdc} (${placeName})`);
      if (formDesc) breakdownParts.push(formDesc);
      if (langName) breakdownParts.push(`Language auxiliary: ${langUdc} (${langName})`);

      return {
        udc: fullUdc,
        ddc: fullDdc,
        title,
        breakdown: breakdownParts.join(' · '),
        explanation: `${s.name} classified with facets: ${[placeName, formDesc, langName].filter(Boolean).join(', ')}.`,
        source: 'UDC & DDC Facet Synthesis Engine'
      };
    }
  }

  if (placeUdc && /\bhistory\b/i.test(t)) {
    return {
      udc: `94${placeUdc}`,
      ddc: `9${placeDdc}`,
      title,
      breakdown: `94 = General history · ${placeUdc} = ${placeName}`,
      explanation: `History of ${placeName}.`,
      source: 'Geographical History Synthesis'
    };
  }

  return null;
}

// ============================================================================
// 3. WORLDSHARE AI / OCLC API
// ============================================================================
async function queryWorldShareAI(title) {
  if (WORLDSHARE_WSKEY) {
    try {
      const q = encodeURIComponent(`srw.ti all "${title}"`);
      const url = `https://worldcat.org/webservices/catalog/search/sru?query=${q}&wskey=${WORLDSHARE_WSKEY}&recordSchema=info:srw/schema/1/marcxml-v1.1&maximumRecords=2`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const xml = await res.text();
        const udcMatch = xml.match(/<datafield tag="080"[^>]*>[\s\S]*?<subfield code="a">(.*?)<\/subfield>/i);
        const ddcMatch = xml.match(/<datafield tag="082"[^>]*>[\s\S]*?<subfield code="a">(.*?)<\/subfield>/i);
        const udc = udcMatch ? udcMatch[1].trim() : null;
        const ddc = ddcMatch ? ddcMatch[1].trim() : null;
        if ((udc && isValidNotation(udc)) || (ddc && isValidNotation(ddc))) {
          return {
            udc: isValidNotation(udc) ? udc : null,
            ddc: isValidNotation(ddc) ? ddc : null,
            source: 'OCLC WorldShare'
          };
        }
      }
    } catch (_) {}
  }

  try {
    const q = encodeURIComponent(title);
    const url = `http://classify.oclc.org/classify2/Classify?title=${q}&summary=true`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LibraryClassifier/1.0' },
      signal: AbortSignal.timeout(3500)
    });
    if (res.ok) {
      const xml = await res.text();
      const ddcMatch = xml.match(/<ddc>[\s\S]*?<mostPopular[^>]*sfa="([^"]+)"/i) || 
                       xml.match(/<ddc>[\s\S]*?<mostRecent[^>]*sfa="([^"]+)"/i);
      if (ddcMatch && isValidNotation(ddcMatch[1].trim())) {
        return {
          udc: null,
          ddc: ddcMatch[1].trim(),
          source: 'OCLC WorldCat Holdings'
        };
      }
    }
  } catch (_) {}

  return null;
}

// ============================================================================
// 4. ANNIF AI QUERY (Validating Notation)
// ============================================================================
async function queryAnnif(title) {
  try {
    const params = new URLSearchParams({ text: title, limit: '5' });
    const res = await fetch(`${ANNIF_API_URL}/projects/${ANNIF_PROJECT}/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
      signal: AbortSignal.timeout(3500)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        for (const r of data.results) {
          // ਯਕੀਨੀ ਬਣਾਓ ਕਿ ਇਹ ਅਸਲ ਨੋਟੇਸ਼ਨ ਹੈ, ਨਾ ਕਿ "public libraries" ਵਰਗਾ ਟੈਕਸਟ
          if (r.notation && isValidNotation(r.notation)) {
            return {
              udc: r.notation.trim(),
              confidence: (r.score * 100).toFixed(0) + '%',
              source: `Annif AI Model (${ANNIF_PROJECT})`
            };
          }
        }
      }
    }
  } catch (_) {}
  return null;
}

// ============================================================================
// 5. GEMINI AI HIGH-PRECISION FALLBACK
// ============================================================================
async function queryGemini(title) {
  if (!GEMINI_API_KEY) return null;
  try {
    const prompt = `Classify this book title precisely into Universal Decimal Classification (UDC) and Dewey Decimal Classification (DDC).
Title: "${title}"
Return ONLY valid JSON:
{
  "udc": "string (valid notation like 027.4(540))",
  "ddc": "string (valid notation like 027.454)",
  "breakdown": "string",
  "explanation": "string"
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (res.ok) {
      const json = await res.json();
      const txt = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (txt) {
        const parsed = JSON.parse(txt);
        if (isValidNotation(parsed.udc)) {
          parsed.source = 'AI Cataloguing Engine';
          return parsed;
        }
      }
    }
  } catch (_) {}
  return null;
}

// ============================================================================
// 6. PIPELINE ORCHESTRATOR
// ============================================================================
app.post('/api/classify', async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required.' });
  }

  const cleanTitle = title.trim();

  const [worldShareRes, annifRes, geminiRes] = await Promise.allSettled([
    queryWorldShareAI(cleanTitle),
    queryAnnif(cleanTitle),
    queryGemini(cleanTitle)
  ]);

  const ws = worldShareRes.status === 'fulfilled' ? worldShareRes.value : null;
  const annif = annifRes.status === 'fulfilled' ? annifRes.value : null;
  const gemini = geminiRes.status === 'fulfilled' ? geminiRes.value : null;
  const syn = synthesizeFacets(cleanTitle);

  let finalUdc = null;
  let finalDdc = null;
  let finalSource = [];
  let finalBreakdown = '';
  let finalExplanation = '';

  // 1. Resolve UDC
  if (syn && (syn.udc.includes('(') || syn.udc.includes('='))) {
    finalUdc = syn.udc;
    finalBreakdown = syn.breakdown;
    finalExplanation = syn.explanation;
    finalSource.push(syn.source);
  } else if (annif && isValidNotation(annif.udc)) {
    finalUdc = annif.udc;
    finalBreakdown = `Annif Classification (${annif.confidence})`;
    finalSource.push(annif.source);
  } else if (gemini && isValidNotation(gemini.udc)) {
    finalUdc = gemini.udc;
    finalBreakdown = gemini.breakdown || '';
    finalExplanation = gemini.explanation || '';
    finalSource.push(gemini.source);
  } else if (ws && isValidNotation(ws.udc)) {
    finalUdc = ws.udc;
    finalSource.push(ws.source);
  } else if (syn) {
    finalUdc = syn.udc;
    finalBreakdown = syn.breakdown;
    finalExplanation = syn.explanation;
    finalSource.push(syn.source);
  }

  // 2. Resolve DDC
  if (ws && isValidNotation(ws.ddc)) {
    finalDdc = ws.ddc;
    finalSource.push(ws.source);
  } else if (syn && isValidNotation(syn.ddc)) {
    finalDdc = syn.ddc;
    if (!finalSource.includes(syn.source)) finalSource.push(syn.source);
  } else if (gemini && isValidNotation(gemini.ddc)) {
    finalDdc = gemini.ddc;
    if (!finalSource.includes(gemini.source)) finalSource.push(gemini.source);
  }

  // Safety fallbacks
  if (!isValidNotation(finalUdc)) finalUdc = '020';
  if (!isValidNotation(finalDdc)) finalDdc = '020';
  if (!finalBreakdown) finalBreakdown = 'Subject classification.';
  if (!finalExplanation) finalExplanation = 'Classification complete.';
  if (finalSource.length === 0) finalSource.push('Standard Classification Engine');

  return res.json({
    title: cleanTitle,
    udc_answer: finalUdc,
    ddc_answer: finalDdc,
    breakdown: finalBreakdown,
    explanation: finalExplanation,
    source: finalSource.join(' + ')
  });
});

// ============================================================================
// 7. CLEAN FRONTEND
// ============================================================================
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Library Classification — UDC & DDC</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f1f5f9; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px 16px 60px; }
    .wrap { max-width: 760px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: clamp(26px, 5vw, 38px); font-weight: 800; color: #1e293b; margin: 0 0 8px; }
    .header p { color: #64748b; font-size: 15px; margin: 0; }
    .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 24px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
    label { display: block; font-size: 12px; font-weight: 800; color: #475569; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.06em; }
    textarea { width: 100%; min-height: 100px; border: 2px solid #cbd5e1; border-radius: 14px; padding: 14px; font-size: 18px; color: #0f172a; outline: none; resize: vertical; font-family: inherit; }
    textarea:focus { border-color: #2563eb; }
    .action-row { display: flex; gap: 10px; margin-top: 14px; }
    button.btn-classify { flex: 1; border: 0; border-radius: 14px; padding: 15px 20px; color: #ffffff; font-weight: 800; font-size: 17px; background: linear-gradient(135deg, #2563eb, #1d4ed8); cursor: pointer; }
    button.btn-classify:disabled { opacity: 0.6; cursor: wait; }
    button.btn-voice { border: 0; border-radius: 14px; padding: 15px 20px; background: #e2e8f0; color: #1e293b; font-weight: 700; font-size: 16px; cursor: pointer; }
    .voice-status { font-size: 13px; color: #64748b; margin-top: 10px; }
    .error-box { display: none; margin-top: 16px; padding: 12px 16px; border-radius: 12px; background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; font-size: 14px; font-weight: 600; }
    #result { display: none; margin-top: 24px; }
    .title-banner { padding-bottom: 14px; border-bottom: 1px solid #f1f5f9; margin-bottom: 18px; }
    .title-banner .subhead { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
    .title-banner h2 { margin: 6px 0 0; font-size: 22px; color: #0f172a; word-break: break-word; }
    .grid-results { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
    .result-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; }
    .result-box.highlight { background: #eff6ff; border-color: #bfdbfe; }
    .result-box .tag { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #2563eb; margin-bottom: 6px; }
    .result-box .number { font-size: clamp(26px, 5vw, 38px); font-weight: 900; color: #0f172a; margin: 4px 0 8px; word-break: break-word; }
    .result-box .detail { font-size: 13px; color: #475569; line-height: 1.45; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px; font-size: 13px; color: #334155; line-height: 1.5; }
    .meta-box b { color: #0f172a; }
    .source-tag { display: inline-block; margin-top: 8px; padding: 4px 10px; border-radius: 999px; background: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 700; }
    @media (max-width: 600px) { .grid-results { grid-template-columns: 1fr; } .action-row { flex-direction: column; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>Library Classification</h1>
      <p>Universal Decimal Classification (UDC) & Dewey Decimal Classification (DDC)</p>
    </div>

    <div class="card">
      <label for="title">Book Title</label>
      <textarea id="title" placeholder="ਕਿਤਾਬ ਦਾ ਟਾਈਟਲ ਲਿਖੋ... e.g. Public Libraries in India">Public Libraries in India</textarea>

      <div class="action-row">
        <button id="go" class="btn-classify">⚡ Classify Book</button>
        <button id="voice" type="button" class="btn-voice">🎙️ Voice</button>
      </div>
      <div id="voiceStatus" class="voice-status">Tap Voice to speak title or type directly.</div>
      <div id="err" class="error-box"></div>
    </div>

    <div id="result" class="card">
      <div class="title-banner">
        <div class="subhead">Title Received</div>
        <h2 id="resTitle"></h2>
      </div>

      <div class="grid-results">
        <div class="result-box highlight">
          <div class="tag">UDC (Universal Decimal)</div>
          <div id="resUdc" class="number">-</div>
          <div id="resUdcBreakdown" class="detail"></div>
        </div>

        <div class="result-box">
          <div class="tag">DDC (Dewey Decimal)</div>
          <div id="resDdc" class="number">-</div>
          <div id="resDdcBreakdown" class="detail"></div>
        </div>
      </div>

      <div class="meta-box">
        <div><b>Explanation & Subject:</b> <span id="resExplain"></span></div>
        <div id="resSource" class="source-tag"></div>
      </div>
    </div>
  </div>

  <script>
    const $ = id => document.getElementById(id);

    $('go').addEventListener('click', async () => {
      const title = $('title').value.trim();
      const errBox = $('err');
      const resBox = $('result');

      errBox.style.display = 'none';
      resBox.style.display = 'none';

      if (!title) {
        errBox.textContent = 'ਕਿਰਪਾ ਕਰਕੇ ਕੋਈ ਟਾਈਟਲ ਦਰਜ ਕਰੋ।';
        errBox.style.display = 'block';
        return;
      }

      $('go').disabled = true;
      $('go').textContent = '⚡ ਲੱਭ ਰਿਹਾ ਹੈ...';

      try {
        const response = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title })
        });

        if (!response.ok) throw new Error('ਸਰਵਰ ਵੱਲੋਂ ਗਲਤੀ ਆਈ ਹੈ।');
        const data = await response.json();

        $('resTitle').textContent = data.title || title;
        $('resUdc').textContent = data.udc_answer || data.udc || '020';
        $('resUdcBreakdown').textContent = data.breakdown || '';
        
        $('resDdc').textContent = data.ddc_answer || data.ddc || '020';
        $('resDdcBreakdown').textContent = data.breakdown || '';

        $('resExplain').textContent = data.explanation || 'ਵਰਗੀਕਰਨ ਪੂਰਾ ਹੋਇਆ।';
        $('resSource').textContent = 'Engine: ' + (data.source || 'Standard Schedule');

        resBox.style.display = 'block';
        resBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (err) {
        errBox.textContent = err.message || 'ਕਲਾਸੀਫਿਕੇਸ਼ਨ ਦੌਰਾਨ ਗਲਤੀ ਆਈ।';
        errBox.style.display = 'block';
      } finally {
        $('go').disabled = false;
        $('go').textContent = '⚡ Classify Book';
      }
    });

    (() => {
      const btn = $('voice');
      const status = $('voiceStatus');
      const field = $('title');
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        btn.addEventListener('click', () => { field.focus(); status.textContent = 'ਕੀਬੋਰਡ ਮਾਈਕ੍ਰੋਫੋਨ ਦੀ ਵਰਤੋਂ ਕਰੋ।'; });
        return;
      }

      const rec = new SpeechRecognition();
      rec.lang = 'en-IN';
      rec.interimResults = false;
      let listening = false;

      btn.addEventListener('click', () => {
        if (listening) { rec.stop(); return; }
        try {
          rec.start();
          listening = true;
          btn.textContent = '⏹ ਰੋਕੋ';
          status.textContent = 'ਸੁਣ ਰਿਹਾ ਹੈ... ਬੋਲੋ (Listening...)';
        } catch (_) { listening = false; }
      });

      rec.onresult = (e) => {
        field.value = e.results[0][0].transcript;
        $('go').click();
      };
      rec.onerror = () => { listening = false; btn.textContent = '🎙️ Voice'; };
      rec.onend = () => { listening = false; btn.textContent = '🎙️ Voice'; };
    })();
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
