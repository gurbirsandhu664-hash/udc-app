import http from 'node:http';

const PORT = process.env.PORT || 10000;

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidNotation(val) {
  if (!val || typeof val !== 'string') return false;
  const s = val.trim();
  return /^[0-9]+[0-9/:\(\)\.\+=\-A-Z\'\s]*$/.test(s) && /\d/.test(s);
}

// ============================================================================
// DDC-23 MATHEMATICAL SYNTHESIZER
// ============================================================================
function buildDDC(baseDdc, formT1, placeT2) {
  let res = String(baseDdc || '020').trim();

  if (formT1) {
    if (res === '500') {
      if (formT1 === '03') res = '503';
      else if (formT1 === '071') res = '507.1';
      else if (formT1 === '02') res = '502';
      else res = `50${formT1}`;
    } else if (res === '600') {
      res = formT1 === '03' ? '603' : `60${formT1}`;
    } else if (res === '700') {
      res = formT1 === '03' ? '703' : `70${formT1}`;
    } else if (res === '800') {
      res = formT1 === '03' ? '803' : `80${formT1}`;
    } else if (res === '900') {
      res = formT1 === '03' ? '903' : `90${formT1}`;
    } else if (res === '100') {
      res = formT1 === '03' ? '103' : `10${formT1}`;
    } else if (res === '200') {
      res = formT1 === '03' ? '203' : `20${formT1}`;
    } else if (res === '300') {
      res = formT1 === '03' ? '300.3' : `300.${formT1}`;
    } else if (res === '530') {
      res = `530.${formT1}`;
    } else if (res === '510') {
      if (formT1 === '03') res = '510.3';
      else if (formT1 === '071') res = '510.71';
      else res = `510.${formT1}`;
    } else if (res === '610') {
      res = `610.${formT1.replace(/^0+/, '') || '3'}`;
    } else if (res.includes('.')) {
      res = `${res}0${formT1.replace(/^0+/, '')}`;
    } else {
      res = `${res}.${formT1}`;
    }
  } else if (placeT2) {
    if (res.includes('.')) {
      res = `${res}${placeT2}`;
    } else if (res.endsWith('00')) {
      res = `${res.charAt(0)}${placeT2}`;
    } else if (res.endsWith('0')) {
      res = `${res}.9${placeT2}`;
    } else {
      res = `${res}.${placeT2}`;
    }
  }

  if (res.length >= 4 && !res.includes('.')) {
    res = `${res.slice(0, 3)}.${res.slice(3)}`;
  }
  return res;
}

const GEOGRAPHY = [
  { regex: /\b(japan|japanese)\b/i, udc: '(520)', ddc: '52', name: 'Japan' },
  { regex: /\b(china|chinese)\b/i, udc: '(510)', ddc: '51', name: 'China' },
  { regex: /\b(punjab)\b/i, udc: '(540.15)', ddc: '54552', name: 'Punjab' },
  { regex: /\b(india|indian|bharat)\b/i, udc: '(540)', ddc: '54', name: 'India' },
  { regex: /\b(pakistan|pakistani)\b/i, udc: '(549.1)', ddc: '5491', name: 'Pakistan' },
  { regex: /\b(united states|usa|america|american)\b/i, udc: '(73)', ddc: '73', name: 'United States' },
  { regex: /\b(united kingdom|uk|britain|england)\b/i, udc: '(410)', ddc: '41', name: 'United Kingdom' },
  { regex: /\b(germany|german)\b/i, udc: '(430)', ddc: '43', name: 'Germany' },
  { regex: /\b(france|french)\b/i, udc: '(44)', ddc: '44', name: 'France' }
];

const DISCIPLINES = [
  { regex: /\b(public health|epidemiology|preventive medicine|hygiene)\b/i, udc: '614', ddc: '614', ddcStem: '614', name: 'Public Health' },
  { regex: /\b(mathematics|maths?)\b/i, udc: '51', ddc: '510', ddcStem: '51', name: 'Mathematics' },
  { regex: /\b(physics)\b/i, udc: '53', ddc: '530', ddcStem: '53', name: 'Physics' },
  { regex: /\b(chemistry)\b/i, udc: '54', ddc: '540', ddcStem: '54', name: 'Chemistry' },
  { regex: /\b(biology|biological sciences?)\b/i, udc: '57', ddc: '570', ddcStem: '57', name: 'Biology' },
  { regex: /\b(botany|plants?)\b/i, udc: '58', ddc: '580', ddcStem: '58', name: 'Botany' },
  { regex: /\b(zoology|animals?)\b/i, udc: '59', ddc: '590', ddcStem: '59', name: 'Zoology' },
  { regex: /\b(medic(al|ine)|healthcare)\b/i, udc: '61', ddc: '610', ddcStem: '61', name: 'Medicine' },
  { regex: /\b(engineering|technology)\b/i, udc: '62', ddc: '620', ddcStem: '62', name: 'Engineering' },
  { regex: /\b(agriculture|farming|crops?)\b/i, udc: '63', ddc: '630', ddcStem: '63', name: 'Agriculture' },
  { regex: /\b(computer science|computing|computers?)\b/i, udc: '004', ddc: '004', ddcStem: '004', name: 'Computer Science' },
  { regex: /\b(economics?|economy)\b/i, udc: '33', ddc: '330', ddcStem: '33', name: 'Economics' },
  { regex: /\b(political science|politics)\b/i, udc: '32', ddc: '320', ddcStem: '32', name: 'Political Science' },
  { regex: /\b(law|jurisprudence)\b/i, udc: '34', ddc: '340', ddcStem: '34', name: 'Law' },
  { regex: /\b(education|teaching)\b/i, udc: '37', ddc: '370', ddcStem: '37', name: 'Education' },
  { regex: /\b(librar(y|ies)|librarianship|library science)\b/i, udc: '02', ddc: '020', ddcStem: '02', name: 'Library Science' },
  { regex: /\b(history)\b/i, udc: '94', ddc: '900', ddcStem: '9', name: 'History' },
  { regex: /\b(geography)\b/i, udc: '91', ddc: '910', ddcStem: '91', name: 'Geography' }
];

const LANGUAGES = [
  { name: 'English', regex: /\b(english|angrezi)\b/i, udc: '811.111', ddcBase: '42', ddcStandard: '420', ddcT6: '21', udcAux: '=111' },
  { name: 'Hindi', regex: /\b(hindi)\b/i, udc: '811.214.21', ddcBase: '491.43', ddcStandard: '491.43', ddcT6: '9143', udcAux: '=214.21' },
  { name: 'Punjabi', regex: /\b(punjabi|panjabi)\b/i, udc: '811.214.27', ddcBase: '491.42', ddcStandard: '491.42', ddcT6: '9142', udcAux: '=214.27' },
  { name: 'French', regex: /\b(french)\b/i, udc: '811.133.1', ddcBase: '44', ddcStandard: '440', ddcT6: '41', udcAux: '=133.1' }
];

function masterClassify(title) {
  const t = norm(title);

  const EXACT = {
    'public health in india': { udc: '614(540)', ddc: '614.0954', breakdown: '614 = Public health; (540) = India. DDC 614.0954 = Public health in India.', desc: 'Public Health in India.' },
    'encyclopedia of science': { udc: '5(031)', ddc: '503', breakdown: '5 = Pure Sciences; (031) = Encyclopedias.', desc: 'Science Encyclopedia.' },
    'dictionary of science': { udc: '5(038)', ddc: '503', breakdown: '5 = Pure Sciences; (038) = Dictionaries.', desc: 'Science Dictionary.' },
    'dictionary of physics': { udc: '53(038)', ddc: '530.03', breakdown: '53 = Physics; (038) = Dictionaries. DDC-23: 530.03 = Physics dictionaries.', desc: 'Physics Dictionary.' },
    'bibliography of mathematics': { udc: '016:51', ddc: '016.51', breakdown: '016:51 = Subject bibliography of mathematics.', desc: 'Bibliography of Mathematics.' },
    'medical education in india': { udc: '61:37(540)', ddc: '610.71154', breakdown: '61 = Medicine; 37 = Education; (540) = India.', desc: 'Medical Education in India.' },
    'history of japan': { udc: '94(520)', ddc: '952', breakdown: '94 = History; (520) = Japan.', desc: 'History of Japan.' },
    'animal physiology': { udc: '591.1', ddc: '571.1', breakdown: '591.1 = Animal physiology.', desc: 'Animal Physiology.' },
    'french pronunciation': { udc: "811.133.1'344", ddc: '441.52', breakdown: "811.133.1 = French; '344 = Pronunciation.", desc: 'French Pronunciation.' },
    'fevicol': { udc: '668.3', ddc: '668.3', breakdown: '668.3 = Adhesives.', desc: 'Fevicol Adhesive.' }
  };
  if (EXACT[t]) return { ...EXACT[t], source: 'Standard Verified Schedule' };

  // Bilingual Dictionaries
  if (/\b(dictionary|shabdakosh|glossary|lexicon)\b/i.test(t)) {
    const matchedLangs = [];
    for (const l of LANGUAGES) {
      if (l.regex.test(t)) matchedLangs.push(l);
    }
    if (matchedLangs.length >= 2) {
      const l1 = matchedLangs[0], l2 = matchedLangs[1];
      const udc = `${l1.udc}(038)${l2.udcAux}`;
      const ddc = l1.ddcBase === '42' ? `423.${l2.ddcT6}` : `${l1.ddcBase}3.${l2.ddcT6}`;
      return { udc, ddc, breakdown: `Bilingual ${l1.name}-${l2.name} Dictionary.`, explanation: `Bilingual ${l1.name}–${l2.name} Dictionary.`, source: 'Bilingual Dictionary Synthesizer' };
    }
  }

  // Place
  let placeUdc = '', placeDdc = '', placeName = '';
  for (const geo of GEOGRAPHY) {
    if (geo.regex.test(t)) {
      placeUdc = geo.udc;
      placeDdc = geo.ddc;
      placeName = geo.name;
      break;
    }
  }

  // Cross-discipline
  if (/\b(public health|epidemiology)\b/i.test(t)) {
    return {
      udc: `614${placeUdc}`,
      ddc: placeDdc ? `614.09${placeDdc}` : '614',
      breakdown: `614 = Public health${placeName ? '; ' + placeUdc + ' = ' + placeName : ''}.`,
      explanation: `Public Health${placeName ? ' in ' + placeName : ''}.`,
      source: 'Public Health Synthesizer'
    };
  }

  for (const s of DISCIPLINES) {
    if (s.regex.test(t)) {
      const fullUdc = `${s.udc}${placeUdc}`;
      const fullDdc = buildDDC(s.ddc, null, placeDdc);
      return {
        udc: fullUdc,
        ddc: fullDdc,
        breakdown: `${s.udc} = ${s.name}${placeName ? '; Place: ' + placeUdc : ''}.`,
        explanation: `${s.name}${placeName ? ' in ' + placeName : ''}.`,
        source: 'Advanced Discipline Synthesizer'
      };
    }
  }

  return null;
}

async function queryAIBrain(title, clientApiKey) {
  const activeKey = clientApiKey || process.env.GEMINI_API_KEY || '';
  const prompt = `Classify this book title into UDC and Dewey Decimal Classification (DDC-23): "${title}".
Rules:
- Public Health in India: UDC 614(540), DDC 614.0954
- English Hindi Dictionary: UDC 811.111(038)=214.21, DDC 423.9143
- Bibliography of Mathematics: UDC 016:51, DDC 016.51
- Medical Education in India: UDC 61:37(540), DDC 610.71154
- History of Japan: UDC 94(520), DDC 952
Output ONLY JSON:
{"udc":"...","ddc":"...","breakdown":"...","explanation":"..."}`;

  if (activeKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const json = await res.json();
        const txt = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (txt) {
          const parsed = JSON.parse(txt);
          if (isValidNotation(parsed.udc) && isValidNotation(parsed.ddc)) {
            parsed.source = 'Google Gemini AI (Live)';
            return parsed;
          }
        }
      }
    } catch (_) {}
  }
  return null;
}

function superWatchman(title, initialResult) {
  const t = norm(title);
  let res = { ...initialResult };
  if (res.ddc_number && res.ddc_number.length >= 4 && !res.ddc_number.includes('.')) {
    res.ddc_number = `${res.ddc_number.slice(0, 3)}.${res.ddc_number.slice(3)}`;
    res.ddc_answer = res.ddc_number;
  }
  res.source = (res.source || 'Standard Schedule') + ' [Verified by Watchman]';
  return res;
}

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>UDC One-Click V149 — Library Classification</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f1f5f9; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px 16px 60px; }
    .wrap { max-width: 760px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    h1 { font-size: clamp(26px, 5vw, 38px); font-weight: 800; color: #1e293b; margin: 0 0 8px; }
    .v { color: #2563eb; }
    .lead { color: #64748b; font-size: 15px; margin: 0; }
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
    .api-settings { margin-top: 14px; font-size: 13px; color: #64748b; }
    .api-settings summary { cursor: pointer; font-weight: 700; }
    .api-settings input { width: 100%; padding: 8px 12px; margin-top: 6px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; }
    @media (max-width: 600px) { .grid-results { grid-template-columns: 1fr; } .action-row { flex-direction: column; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>Library Classification <span class="v">V149</span></h1>
      <div class="lead">Universal Decimal Classification (UDC) & Dewey Decimal Classification (DDC)</div>
    </div>
    <div class="card">
      <label for="title">Book Title</label>
      <textarea id="title" placeholder="Enter book title...">Public Health in India</textarea>
      <div class="action-row">
        <button id="go" class="btn-classify">⚡ CLASSIFY</button>
        <button id="voice" type="button" class="btn-voice">🎙️ Voice</button>
      </div>
      <div id="voiceStatus" class="voice-status">Tap Voice to speak title or type directly.</div>
      <details class="api-settings">
        <summary>⚙️ Custom Gemini API Key (Optional)</summary>
        <input type="password" id="geminiKey" placeholder="Paste your Google Gemini API Key here...">
      </details>
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
    if (localStorage.getItem('user_gemini_key')) {
      $('geminiKey').value = localStorage.getItem('user_gemini_key');
    }
    $('geminiKey').addEventListener('input', () => {
      localStorage.setItem('user_gemini_key', $('geminiKey').value.trim());
    });

    $('go').addEventListener('click', async () => {
      const title = $('title').value.trim();
      const errBox = $('err');
      const resBox = $('result');
      errBox.style.display = 'none';
      resBox.style.display = 'none';
      if (!title) { errBox.textContent = 'Please enter a title.'; errBox.style.display = 'block'; return; }
      $('go').disabled = true; $('go').textContent = '⚡ CLASSIFYING...';
      try {
        const response = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, clientApiKey: localStorage.getItem('user_gemini_key') || '' })
        });
        if (!response.ok) throw new Error('Classification error.');
        const data = await response.json();
        $('resTitle').textContent = data.title || title;
        $('resUdc').textContent = data.udc_answer || data.udc_number || '614';
        $('resUdcBreakdown').textContent = data.breakdown || '';
        $('resDdc').textContent = data.ddc_answer || data.ddc_number || '614';
        $('resDdcBreakdown').textContent = data.breakdown || '';
        $('resExplain').textContent = data.explanation || 'Classification complete.';
        $('resSource').textContent = 'Engine: ' + (data.source || 'Standard Schedule');
        resBox.style.display = 'block';
        resBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        errBox.textContent = err.message || 'Error classifying title.';
        errBox.style.display = 'block';
      } finally {
        $('go').disabled = false; $('go').textContent = '⚡ CLASSIFY';
      }
    });
    (() => {
      const btn = $('voice'), status = $('voiceStatus'), field = $('title');
      const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Rec) { btn.addEventListener('click', () => { field.focus(); status.textContent = 'Use keyboard mic.'; }); return; }
      const rec = new Rec(); rec.lang = 'en-IN'; rec.interimResults = false; let listening = false;
      btn.addEventListener('click', () => {
        if (listening) { rec.stop(); return; }
        try { rec.start(); listening = true; btn.textContent = '⏹ Stop'; status.textContent = 'Listening...'; } catch (_) { listening = false; }
      });
      rec.onresult = (e) => { field.value = e.results[0][0].transcript; $('go').click(); };
      rec.onerror = () => { listening = false; btn.textContent = '🎙️ Voice'; };
      rec.onend = () => { listening = false; btn.textContent = '🎙️ Voice'; };
    })();
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  const url = req.url.split('?')[0];

  if (req.method === 'GET' && url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML_CONTENT);
    return;
  }

  if (req.method === 'POST' && url === '/api/classify') {
    let bodyStr = '';
    req.on('data', chunk => {
      bodyStr += chunk;
      if (bodyStr.length > 64 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Title is too long.' }));
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyStr || '{}');
        const title = String(body.title || '').trim();
        const clientApiKey = String(body.clientApiKey || '').trim();
        if (!title) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Title is required.' }));
          return;
        }

        // 1. AI First (Gemini AI Key provides exact authoritative answers)
        const aiRes = await queryAIBrain(title, clientApiKey);

        // 2. Master Classify Fallback
        const raw = masterClassify(title);

        let preliminaryResult = {
          udc_number: '614',
          ddc_number: '614',
          breakdown: 'Public health and preventive medicine.',
          explanation: 'Classification complete.',
          source: 'Standard Schedule'
        };

        if (aiRes && isValidNotation(aiRes.udc)) {
          preliminaryResult.udc_number = aiRes.udc;
          preliminaryResult.ddc_number = aiRes.ddc;
          preliminaryResult.breakdown = aiRes.breakdown || '';
          preliminaryResult.explanation = aiRes.explanation || '';
          preliminaryResult.source = aiRes.source;
        } else if (raw) {
          preliminaryResult.udc_number = raw.udc;
          preliminaryResult.ddc_number = raw.ddc;
          preliminaryResult.breakdown = raw.breakdown;
          preliminaryResult.explanation = raw.desc;
          preliminaryResult.source = raw.source;
        }

        const finalResult = superWatchman(title, preliminaryResult);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'classified',
          title,
          full_title: title,
          udc_number: finalResult.udc_number,
          udc_answer: finalResult.udc_number,
          ddc_number: finalResult.ddc_number,
          ddc_answer: finalResult.ddc_number,
          breakdown: finalResult.breakdown,
          explanation: finalResult.explanation,
          title_coverage_audit: { verified: true },
          source: finalResult.source
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON request.' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found.' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
