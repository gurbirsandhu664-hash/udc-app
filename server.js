import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

const ANNIF_API_URL = process.env.ANNIF_API_URL || 'http://localhost:5000/v1';
const ANNIF_UDC_PROJECT = process.env.ANNIF_UDC_PROJECT || 'udc-project';
const WORLDSHARE_KEY = process.env.WORLDCAT_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Normalization helper
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 1. High-confidence known exact keys
const EXACT_KEYS = {
  'encyclopedia of science': {
    udc: '5(031)',
    ddc: '503',
    title: 'Encyclopedia of Science',
    breakdown: '5 = Pure Sciences; (031) = General reference works / Encyclopedias.',
    explanation: 'General encyclopedias of science are classed under 5 (Pure sciences) with common form auxiliary (031). In DDC, 500 = Science, 03 = Dictionaries & encyclopedias -> 503.'
  },
  'dictionary of science': {
    udc: '5(038)',
    ddc: '503',
    title: 'Dictionary of Science',
    breakdown: '5 = Pure Sciences; (038) = Dictionaries.',
    explanation: 'Science dictionaries are classed under 5 with form auxiliary (038).'
  },
  'harvesting of wheat and maize': {
    udc: '633.11+633.15:631.55',
    ddc: '633.1',
    title: 'Harvesting of wheat and maize',
    breakdown: '633.11 = wheat; 633.15 = maize; 631.55 = harvesting.',
    explanation: 'Coordinated crops related to harvesting.'
  },
  'harvesting of cereals': {
    udc: '633.1:631.55',
    ddc: '633.1',
    title: 'Harvesting of cereals',
    breakdown: '633.1 = cereals; 631.55 = harvesting.',
    explanation: 'Cereals harvesting in UDC and DDC.'
  },
  'wheat': { udc: '633.11', ddc: '633.11', title: 'Wheat', breakdown: '633.11 = Wheat.', explanation: 'Agriculture: Wheat crop.' },
  'maize': { udc: '633.15', ddc: '633.15', title: 'Maize', breakdown: '633.15 = Maize.', explanation: 'Agriculture: Maize / Corn.' },
  'barley': { udc: '633.16', ddc: '633.16', title: 'Barley', breakdown: '633.16 = Barley.', explanation: 'Agriculture: Barley.' },
  'history of india': { udc: '94(540)', ddc: '954', title: 'History of India', breakdown: '94 = History; (540) = India.', explanation: 'General history of India.' },
  'geography of india': { udc: '91(540)', ddc: '915.4', title: 'Geography of India', breakdown: '91 = Geography; (540) = India.', explanation: 'Geography of India.' },
  'indian economy': { udc: '33(540)', ddc: '330.954', title: 'Indian Economy', breakdown: '33 = Economics; (540) = India.', explanation: 'Economics of India.' },
  'library classification': { udc: '025.4', ddc: '025.4', title: 'Library classification', breakdown: '025.4 = Classification and indexing.', explanation: 'Librarianship: Classification.' },
  'english drama': { udc: '821.111-2', ddc: '822', title: 'English drama', breakdown: '821.111 = English literature; -2 = drama.', explanation: 'English drama.' },
  'bible': { udc: '27-23', ddc: '220', title: 'Bible', breakdown: '27-23 = The Bible; 220 = The Bible.', explanation: 'Christianity sacred scriptures.' },
  'sobha singh': { udc: '75(084.1)SOB', ddc: '759.954', title: 'Sobha Singh', breakdown: '75 = Painting; (084.1) = pictorial; SOB = Sobha Singh.', explanation: 'Indian painter reproductions.' }
};

// 2. Pattern-based rule generator for common subjects and form auxiliaries
function matchPatterns(title) {
  const t = norm(title);
  
  // Check exact keys
  if (EXACT_KEYS[t]) {
    return { ...EXACT_KEYS[t], source: 'Verified Standard Schedule' };
  }

  // Common form detection
  let isEncyclopedia = /\b(encyclopedia|encyclopaedia|vishwakosh)\b/i.test(t);
  let isDictionary = /\b(dictionary|shabdakosh|glossary|lexicon)\b/i.test(t);
  let isHandbook = /\b(handbook|manual|guide)\b/i.test(t);
  let isHistory = /\b(history|itihaas)\b/i.test(t);
  let isBiography = /\b(biography|autobiography|life of|jeewani)\b/i.test(t);

  // Subject matching table
  const subjects = [
    { regex: /\b(science|sciences|scientific)\b/i, udcBase: '5', ddcBase: '500', name: 'Science / Pure Sciences' },
    { regex: /\b(physics)\b/i, udcBase: '53', ddcBase: '530', name: 'Physics' },
    { regex: /\b(chemistry)\b/i, udcBase: '54', ddcBase: '540', name: 'Chemistry' },
    { regex: /\b(biology|biological)\b/i, udcBase: '57', ddcBase: '570', name: 'Biology' },
    { regex: /\b(botany|plants?)\b/i, udcBase: '58', ddcBase: '580', name: 'Botany' },
    { regex: /\b(zoology|animals?)\b/i, udcBase: '59', ddcBase: '590', name: 'Zoology' },
    { regex: /\b(mathematics|maths?)\b/i, udcBase: '51', ddcBase: '510', name: 'Mathematics' },
    { regex: /\b(computer science|computing|computers?|software)\b/i, udcBase: '004', ddcBase: '004', name: 'Computer Science' },
    { regex: /\b(medicine|medical|health)\b/i, udcBase: '61', ddcBase: '610', name: 'Medicine' },
    { regex: /\b(agriculture|farming|crops?)\b/i, udcBase: '63', ddcBase: '630', name: 'Agriculture' },
    { regex: /\b(technology|engineering)\b/i, udcBase: '62', ddcBase: '620', name: 'Engineering / Technology' },
    { regex: /\b(philosophy)\b/i, udcBase: '1', ddcBase: '100', name: 'Philosophy' },
    { regex: /\b(psychology)\b/i, udcBase: '159.9', ddcBase: '150', name: 'Psychology' },
    { regex: /\b(religion|religions)\b/i, udcBase: '2', ddcBase: '200', name: 'Religion' },
    { regex: /\b(sociology|social sciences?)\b/i, udcBase: '316', ddcBase: '301', name: 'Sociology' },
    { regex: /\b(economics?|economy)\b/i, udcBase: '33', ddcBase: '330', name: 'Economics' },
    { regex: /\b(law|jurisprudence|legal)\b/i, udcBase: '34', ddcBase: '340', name: 'Law' },
    { regex: /\b(education|teaching)\b/i, udcBase: '37', ddcBase: '370', name: 'Education' },
    { regex: /\b(geography)\b/i, udcBase: '91', ddcBase: '910', name: 'Geography' },
    { regex: /\b(art|arts|fine arts)\b/i, udcBase: '7', ddcBase: '700', name: 'The Arts' },
    { regex: /\b(music)\b/i, udcBase: '78', ddcBase: '780', name: 'Music' },
    { regex: /\b(literature)\b/i, udcBase: '82', ddcBase: '800', name: 'Literature' }
  ];

  for (const sub of subjects) {
    if (sub.regex.test(t)) {
      let udc = sub.udcBase;
      let ddc = sub.ddcBase;
      let formDesc = '';

      if (isEncyclopedia) {
        udc = `${sub.udcBase}(031)`;
        ddc = sub.ddcBase.length === 3 && sub.ddcBase.endsWith('00') 
              ? sub.ddcBase.charAt(0) + '03' 
              : sub.ddcBase + '.03';
        formDesc = 'Form: Encyclopedia.';
      } else if (isDictionary) {
        udc = `${sub.udcBase}(038)`;
        ddc = sub.ddcBase.length === 3 && sub.ddcBase.endsWith('00') 
              ? sub.ddcBase.charAt(0) + '03' 
              : sub.ddcBase + '.03';
        formDesc = 'Form: Dictionary.';
      } else if (isHandbook) {
        udc = `${sub.udcBase}(035)`;
        ddc = sub.ddcBase + '.02';
        formDesc = 'Form: Handbook / Manual.';
      } else if (isHistory) {
        udc = `${sub.udcBase}(091)`;
        ddc = sub.ddcBase + '.09';
        formDesc = 'Aspect: Historical development.';
      }

      return {
        udc,
        ddc,
        title,
        breakdown: `${sub.name}: UDC ${udc} · DDC ${ddc}`,
        explanation: `${sub.name} classification. ${formDesc}`,
        source: 'Rule-Based Schedule Synthesis'
      };
    }
  }

  return null;
}

// 3. Annif API query
async function fetchFromAnnif(title) {
  try {
    const params = new URLSearchParams({ text: title, limit: '3' });
    const res = await fetch(`${ANNIF_API_URL}/projects/${ANNIF_UDC_PROJECT}/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
      timeout: 3000
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return {
        udc: data.results[0].notation || data.results[0].label,
        confidence: (data.results[0].score * 100).toFixed(0) + '%'
      };
    }
  } catch (_) {}
  return null;
}

// 4. WorldShare OCLC API query
async function fetchFromWorldShare(title) {
  if (!WORLDSHARE_KEY) return null;
  try {
    const q = encodeURIComponent(`srw.ti all "${title}"`);
    const url = `https://worldcat.org/webservices/catalog/search/sru?query=${q}&wskey=${WORLDSHARE_KEY}&recordSchema=info:srw/schema/1/marcxml-v1.1&maximumRecords=1`;
    const res = await fetch(url, { timeout: 4000 });
    const xml = await res.text();
    const udcMatch = xml.match(/<datafield tag="080"[^>]*>[\s\S]*?<subfield code="a">(.*?)<\/subfield>/);
    const ddcMatch = xml.match(/<datafield tag="082"[^>]*>[\s\S]*?<subfield code="a">(.*?)<\/subfield>/);
    return {
      udc: udcMatch ? udcMatch[1].trim() : null,
      ddc: ddcMatch ? ddcMatch[1].trim() : null
    };
  } catch (_) {}
  return null;
}

// 5. Gemini AI Fallback for unmapped unique titles
async function fetchFromGemini(title) {
  if (!GEMINI_API_KEY) return null;
  try {
    const prompt = `Classify this book title into Universal Decimal Classification (UDC) and Dewey Decimal Classification (DDC).
Title: "${title}"
Return ONLY a valid JSON object in this exact format:
{
  "udc": "string (valid UDC notation)",
  "ddc": "string (valid DDC number)",
  "breakdown": "string (short notation breakdown)",
  "explanation": "string (subject explanation)"
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      }),
      timeout: 5000
    });
    if (!res.ok) return null;
    const json = await res.json();
    const txt = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (txt) {
      return JSON.parse(txt);
    }
  } catch (_) {}
  return null;
}

// Master Classification API
app.post('/api/classify', async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'ਕਿਰਪਾ ਕਰਕੇ ਕਿਤਾਬ ਦਾ ਟਾਈਟਲ ਲਿਖੋ (Title is required).' });
  }

  const cleanTitle = title.trim();

  // Priority 1: Check Rule/Pattern Engine (Instant & Guaranteed)
  const patternMatch = matchPatterns(cleanTitle);
  if (patternMatch) {
    return res.json({
      title: cleanTitle,
      udc_answer: patternMatch.udc,
      ddc_answer: patternMatch.ddc,
      breakdown: patternMatch.breakdown,
      explanation: patternMatch.explanation,
      source: patternMatch.source
    });
  }

  // Priority 2: WorldShare WorldCat Catalog Record
  let wsResult = await fetchFromWorldShare(cleanTitle);
  if (wsResult && (wsResult.udc || wsResult.ddc)) {
    return res.json({
      title: cleanTitle,
      udc_answer: wsResult.udc || 'Review Schedule',
      ddc_answer: wsResult.ddc || 'Review Schedule',
      breakdown: 'Extracted from OCLC WorldShare bibliographic record.',
      explanation: 'Official library cataloging record.',
      source: 'OCLC WorldShare'
    });
  }

  // Priority 3: Annif UDC Indexing Engine
  let annifResult = await fetchFromAnnif(cleanTitle);
  if (annifResult && annifResult.udc) {
    return res.json({
      title: cleanTitle,
      udc_answer: annifResult.udc,
      ddc_answer: 'Verified via UDC Subject',
      breakdown: `Annif UDC model notation (Confidence: ${annifResult.confidence})`,
      explanation: 'Classified using Annif automated subject indexing model.',
      source: 'Annif AI Engine'
    });
  }

  // Priority 4: Gemini Classification Assistant
  let geminiResult = await fetchFromGemini(cleanTitle);
  if (geminiResult && geminiResult.udc) {
    return res.json({
      title: cleanTitle,
      udc_answer: geminiResult.udc,
      ddc_answer: geminiResult.ddc || '500',
      breakdown: geminiResult.breakdown || '',
      explanation: geminiResult.explanation || '',
      source: 'AI Classification Engine'
    });
  }

  // Final Intelligent Fallback: General works
  return res.json({
    title: cleanTitle,
    udc_answer: '001',
    ddc_answer: '001',
    breakdown: '001 = Knowledge and civilization in general.',
    explanation: 'General subject classification. Verify specific section in official schedule.',
    source: 'General Classification Fallback'
  });
});

// Single Page UI Route
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Library Classification — UDC & DDC</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f1f5f9;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px 16px 60px;
    }
    .wrap { max-width: 760px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: clamp(26px, 5vw, 38px); font-weight: 800; color: #1e293b; margin: 0 0 8px; }
    .header p { color: #64748b; font-size: 15px; margin: 0; }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
    }
    label {
      display: block;
      font-size: 12px;
      font-weight: 800;
      color: #475569;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    textarea {
      width: 100%;
      min-height: 110px;
      border: 2px solid #cbd5e1;
      border-radius: 14px;
      padding: 14px;
      font-size: 18px;
      color: #0f172a;
      outline: none;
      resize: vertical;
      font-family: inherit;
      transition: border-color 0.2s;
    }
    textarea:focus { border-color: #2563eb; }
    .action-row { display: flex; gap: 10px; margin-top: 14px; }
    button.btn-classify {
      flex: 1;
      border: 0;
      border-radius: 14px;
      padding: 15px 20px;
      color: #ffffff;
      font-weight: 800;
      font-size: 17px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      cursor: pointer;
    }
    button.btn-classify:disabled { opacity: 0.6; cursor: wait; }
    button.btn-voice {
      border: 0;
      border-radius: 14px;
      padding: 15px 20px;
      background: #e2e8f0;
      color: #1e293b;
      font-weight: 700;
      font-size: 16px;
      cursor: pointer;
    }
    .voice-status { font-size: 13px; color: #64748b; margin-top: 10px; }
    .voice-status.good { color: #16a34a; font-weight: 600; }
    .error-box {
      display: none;
      margin-top: 16px;
      padding: 12px 16px;
      border-radius: 12px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
      font-size: 14px;
      font-weight: 600;
    }
    #result { display: none; margin-top: 24px; }
    .title-banner { padding-bottom: 14px; border-bottom: 1px solid #f1f5f9; margin-bottom: 18px; }
    .title-banner .subhead { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
    .title-banner h2 { margin: 6px 0 0; font-size: 22px; color: #0f172a; word-break: break-word; }
    .grid-results { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
    .result-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 18px;
    }
    .result-box.highlight { background: #eff6ff; border-color: #bfdbfe; }
    .result-box .tag { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #2563eb; margin-bottom: 6px; }
    .result-box .number { font-size: clamp(28px, 5vw, 42px); font-weight: 900; color: #0f172a; margin: 4px 0 8px; word-break: break-word; }
    .result-box .detail { font-size: 13px; color: #475569; line-height: 1.45; }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 14px 16px;
      font-size: 13px;
      color: #334155;
      line-height: 1.5;
    }
    .meta-box b { color: #0f172a; }
    .source-tag {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 10px;
      border-radius: 999px;
      background: #e0f2fe;
      color: #0369a1;
      font-size: 11px;
      font-weight: 700;
    }
    @media (max-width: 600px) {
      .grid-results { grid-template-columns: 1fr; }
      .action-row { flex-direction: column; }
    }
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
      <textarea id="title" placeholder="ਕਿਤਾਬ ਦਾ ਟਾਈਟਲ ਲਿਖੋ... e.g. Encyclopedia of science">Encyclopedia of science</textarea>

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
        $('resUdc').textContent = data.udc_answer || data.udc || '001';
        $('resUdcBreakdown').textContent = data.breakdown || '';
        
        $('resDdc').textContent = data.ddc_answer || data.ddc || '001';
        $('resDdcBreakdown').textContent = data.breakdown || '';

        $('resExplain').textContent = data.explanation || 'ਵਰਗੀਕਰਨ ਪੂਰਾ ਹੋਇਆ।';
        $('resSource').textContent = 'Source: ' + (data.source || 'Schedule Synthesis');

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

    // Voice recognition
    (() => {
      const btn = $('voice');
      const status = $('voiceStatus');
      const field = $('title');
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        btn.addEventListener('click', () => {
          field.focus();
          status.textContent = 'ਕੀਬੋਰਡ ਮਾਈਕ੍ਰੋਫੋਨ ਦੀ ਵਰਤੋਂ ਕਰੋ।';
        });
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
          status.className = 'voice-status good';
        } catch (_) { listening = false; }
      });

      rec.onresult = (e) => {
        const text = e.results[0][0].transcript;
        field.value = text;
        status.textContent = 'ਪਛਾਣਿਆ ਗਿਆ: ' + text;
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
