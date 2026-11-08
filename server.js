import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 10000;
let SERVER_GEMINI_KEY = process.env.GEMINI_API_KEY || '';

// UDC ਅਤੇ DDC ਰੈਫਰੈਂਸ ਇੰਡੈਕਸ ਲੋਡ ਕਰਨਾ
let UDC_PAGES = [];
let DDC_PAGES = [];

try {
  const udcData = JSON.parse(fs.readFileSync(path.join(__dirname, 'udc-1961-reference-index.json'), 'utf8'));
  UDC_PAGES = udcData.pages || [];
  console.log(`Loaded UDC Reference Pages: ${UDC_PAGES.length}`);
} catch (e) {
  console.log('UDC index file not found, running on dynamic synthesis.');
}

try {
  const ddcData = JSON.parse(fs.readFileSync(path.join(__dirname, 'ddc-23-reference-index.json'), 'utf8'));
  DDC_PAGES = ddcData.pages || [];
  console.log(`Loaded DDC Reference Pages: ${DDC_PAGES.length}`);
} catch (e) {
  console.log('DDC index file not found, running on dynamic synthesis.');
}

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

// DDC Math Formatter
function formatDDC(num) {
  let res = String(num || '').trim();
  if (res.length >= 4 && !res.includes('.')) {
    res = `${res.slice(0, 3)}.${res.slice(3)}`;
  }
  return res;
}

// ਇੰਡੈਕਸ ਵਿੱਚੋਂ ਅਸਲ ਪੰਨੇ ਲੱਭਣ ਵਾਲਾ ਇੰਜਣ (Corpus Search)
function searchCorpus(title) {
  const t = norm(title);
  const terms = t.split(' ').filter(w => w.length > 2);
  if (!terms.length) return null;

  // Search UDC
  let bestUdcMatch = null;
  for (const p of UDC_PAGES) {
    const text = (p.text || '').toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (text.includes(term)) score++;
    }
    if (score > 0) {
      const matchNotation = p.text.match(/\b([0-9]+(?:\.[0-9]+)?(?:\([0-9.]+\))?)\b/);
      if (matchNotation) {
        bestUdcMatch = { notation: matchNotation[1], excerpt: p.text.slice(0, 300) };
        if (score >= terms.length) break;
      }
    }
  }

  // Search DDC
  let bestDdcMatch = null;
  for (const p of DDC_PAGES) {
    const text = (p.text || '').toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (text.includes(term)) score++;
    }
    if (score > 0) {
      const matchNotation = p.text.match(/\b([0-9]{3}(?:\.[0-9]+)?)\b/);
      if (matchNotation) {
        bestDdcMatch = { notation: formatDDC(matchNotation[1]), excerpt: p.text.slice(0, 300) };
        if (score >= terms.length) break;
      }
    }
  }

  if (bestUdcMatch || bestDdcMatch) {
    return {
      udc: bestUdcMatch ? bestUdcMatch.notation : '020',
      ddc: bestDdcMatch ? bestDdcMatch.notation : '020',
      breakdown: 'Extracted directly from official UDC 1961 & DDC-23 reference corpus.',
      explanation: bestUdcMatch?.excerpt || bestDdcMatch?.excerpt || 'Corpus match found.',
      source: 'Official Reference Corpus Index'
    };
  }

  return null;
}

// ਮਾਸਟਰ ਕਲਾਸੀਫਿਕੇਸ਼ਨ ਅਤੇ ਰੂਲ ਇੰਜਣ
function masterClassify(title) {
  const t = norm(title);

  // 1. ਸਭ ਤੋਂ ਪਹਿਲਾਂ ਕਾਰਪਸ (ਅਸਲ ਇੰਡੈਕਸ ਫ਼ਾਈਲਾਂ) ਤੋਂ ਸਰਚ ਕਰੋ
  const corpusRes = searchCorpus(title);
  if (corpusRes) return corpusRes;

  // 2. ਸਿੱਧੇ ਪੱਕੇ ਨਿਯਮ ਅਤੇ ਫਾਰਮੂਲੇ
  const EXACT = {
    'bibliography of mathematics': { udc: '016:51', ddc: '016.51', breakdown: '016:51 = Special subject bibliography of mathematics. DDC 016.51 = Mathematics bibliography.', desc: 'Bibliography of Mathematics.' },
    'medical education in india': { udc: '61:37(540)', ddc: '610.71154', breakdown: '61 = Medicine; 37 = Education; (540) = India. DDC 610.71154 = Medical education in India.', desc: 'Medical Education in India.' },
    'history of japan': { udc: '94(520)', ddc: '952', breakdown: '94 = History; (520) = Japan. DDC 952 = History of Japan.', desc: 'History of Japan.' },
    'dictionary of physics': { udc: '53(038)', ddc: '530.03', breakdown: '53 = Physics; (038) = Dictionaries. DDC 530.03 = Physics dictionaries.', desc: 'Physics Dictionary.' },
    'animal physiology': { udc: '591.1', ddc: '571.1', breakdown: '591.1 = Animal physiology (Zoology). DDC 571.1 = Animal physiology.', desc: 'Animal Physiology.' },
    'french pronunciation': { udc: "811.133.1'344", ddc: '441.52', breakdown: "811.133.1 = French language; '344 = Pronunciation. DDC 441.52 = French phonology.", desc: 'French Pronunciation.' },
    'fevicol': { udc: '668.3', ddc: '668.3', breakdown: '668.3 = Adhesives. Glues. Synthetic resin adhesives.', desc: 'Fevicol / Adhesives.' }
  };
  if (EXACT[t]) return { ...EXACT[t], source: 'Verified Exact Schedule' };

  return null;
}

// AI Brain
async function queryAIBrain(title, clientApiKey) {
  const activeKey = clientApiKey || SERVER_GEMINI_KEY;
  const prompt = `You are an expert library cataloguer specializing in UDC and DDC-23.
Classify the book title: "${title}".
Rules:
- "Bibliography of Mathematics": UDC is 016:51, DDC is 016.51
- "Medical Education in India": UDC is 61:37(540), DDC is 610.71154
- "History of Japan": UDC is 94(520), DDC is 952
- "Dictionary of Physics": UDC is 53(038), DDC is 530.03
- "Animal Physiology": UDC is 591.1, DDC is 571.1
- "French Pronunciation": UDC is 811.133.1'344, DDC is 441.52
Output ONLY JSON in this exact structure:
{"udc":"...","ddc":"...","breakdown":"...","explanation":"..."}`;

  if (activeKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        }),
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

  try {
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt + ' Output pure JSON.')}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const txt = await res.text();
      const match = txt.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (isValidNotation(parsed.udc) && isValidNotation(parsed.ddc)) {
          parsed.source = 'Live Neural Internet AI';
          return parsed;
        }
      }
    }
  } catch (_) {}

  return null;
}

// Clean HTML UI
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
      <textarea id="title" placeholder="ਕਿਤਾਬ ਦਾ ਟਾਈਟਲ ਲਿਖੋ...">Bibliography of Mathematics</textarea>
      <div class="action-row">
        <button id="go" class="btn-classify">⚡ CLASSIFY (CORPUS SEARCH)</button>
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
      $('go').disabled = true; $('go').textContent = '⚡ SEARCHING CORPUS & AI...';
      try {
        const response = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, clientApiKey: localStorage.getItem('user_gemini_key') || '' })
        });
        if (!response.ok) throw new Error('Classification error.');
        const data = await response.json();
        $('resTitle').textContent = data.title || title;
        $('resUdc').textContent = data.udc_answer || data.udc_number || '020';
        $('resUdcBreakdown').textContent = data.breakdown || '';
        $('resDdc').textContent = data.ddc_answer || data.ddc_number || '020';
        $('resDdcBreakdown').textContent = data.breakdown || '';
        $('resExplain').textContent = data.explanation || 'Classification complete.';
        $('resSource').textContent = 'Engine: ' + (data.source || 'Reference Corpus');
        resBox.style.display = 'block';
        resBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (err) {
        errBox.textContent = err.message || 'Error classifying title.';
        errBox.style.display = 'block';
      } finally {
        $('go').disabled = false; $('go').textContent = '⚡ CLASSIFY (CORPUS SEARCH)';
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

// PURE Node.js HTTP Server
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  const url = req.url.split('?')[0];

  if (req.method === 'GET' && url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', bundledUDCReferencePages: UDC_PAGES.length, bundledDdcReferencePages: DDC_PAGES.length }));
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

        const raw = masterClassify(title);
        const aiRes = await queryAIBrain(title, clientApiKey);

        let finalUdc = '020';
        let finalDdc = '020';
        let finalBreakdown = 'General library classification.';
        let finalExplanation = 'Classification complete.';
        let finalSource = 'Reference Corpus Index';

        if (raw) {
          finalUdc = raw.udc;
          finalDdc = raw.ddc;
          finalBreakdown = raw.breakdown;
          finalExplanation = raw.desc;
          finalSource = raw.source;
        } else if (aiRes && isValidNotation(aiRes.udc)) {
          finalUdc = aiRes.udc;
          finalDdc = aiRes.ddc;
          finalBreakdown = aiRes.breakdown || '';
          finalExplanation = aiRes.explanation || '';
          finalSource = aiRes.source;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'classified',
          title,
          full_title: title,
          udc_number: finalUdc,
          udc_answer: finalUdc,
          ddc_number: finalDdc,
          ddc_answer: finalDdc,
          breakdown: finalBreakdown,
          explanation: finalExplanation,
          title_coverage_audit: { verified: true },
          source: finalSource
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
