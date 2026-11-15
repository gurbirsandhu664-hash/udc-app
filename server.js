import http from 'node:http';
import fs from 'node:fs';
import zlib from 'node:zlib';

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const CACHE_FILE = './ai-cache-v22.json';

// 1. Persistent Disk Cache
let diskCache = {};
try {
  if (fs.existsSync(CACHE_FILE)) {
    diskCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  }
} catch (e) {}

function saveCache(key, val) {
  diskCache[key] = val;
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(diskCache));
  } catch (e) {}
}

// 2. Load Local Reference Indexes
const flatUdc = new Map();
const flatDdc = new Map();

function extractEntries(node, targetMap) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(item => extractEntries(item, targetMap));
    return;
  }
  const label = node.title || node.subject || node.name || node.caption || node.label || node.heading;
  const code = node.code || node.number || node.notation || node.udc || node.ddc || node.class;
  if (typeof label === 'string' && (typeof code === 'string' || typeof code === 'number')) {
    targetMap.set(label.toLowerCase().trim(), String(code).trim());
  }
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'string' || typeof v === 'number') {
      const cleanK = k.toLowerCase().trim();
      if (cleanK.length > 2 && !['code', 'number', 'notation', 'title', 'subject', 'name', 'id'].includes(cleanK)) {
        targetMap.set(cleanK, String(v).trim());
      }
    } else if (typeof v === 'object') {
      extractEntries(v, targetMap);
    }
  }
}

try {
  if (fs.existsSync('./ddc-23-reference-index.json')) {
    extractEntries(JSON.parse(fs.readFileSync('./ddc-23-reference-index.json', 'utf8')), flatDdc);
  }
  if (fs.existsSync('./udc-1961-reference-index.json')) {
    extractEntries(JSON.parse(fs.readFileSync('./udc-1961-reference-index.json', 'utf8')), flatUdc);
  }
} catch (e) {}

// 3. Complete Subject Schedule (Railway, Science & Tech, etc.)
const SUBJECT_SCHEDULE = [
  { keys: ['railway transportation', 'railway transport', 'railways', 'railroad', 'rail transport'], udc: '656.2', ddc: '385', ddcBase: '385', name: 'Railway Transport' },
  { keys: ['science and technology', 'science & technology', 'science and tech', 'technology and science'], udc: '5/6', ddc: '600', ddcBase: '600', name: 'Science & Technology' },
  { keys: ['phonetics of the english language', 'english phonetics', 'phonology of english'], udc: "811.111'34", ddc: '421.5', ddcBase: '4215', name: 'English Phonetics & Phonology' },
  { keys: ['english grammar'], udc: "811.111'36", ddc: '425', ddcBase: '425', name: 'English Grammar' },
  { keys: ['english language'], udc: '811.111', ddc: '420', ddcBase: '42', name: 'English Language' },
  { keys: ['punjabi language'], udc: '811.214.2', ddc: '491.42', ddcBase: '49142', name: 'Punjabi Language' },
  { keys: ['hindi language'], udc: '811.214.21', ddc: '491.43', ddcBase: '49143', name: 'Hindi Language' },
  { keys: ['library management', 'library administration'], udc: '025', ddc: '025.1', ddcBase: '0251', name: 'Library Management & Administration' },
  { keys: ['library classification', 'classification of books', 'ddc', 'udc'], udc: '025.4', ddc: '025.42', ddcBase: '02542', name: 'Library Classification' },
  { keys: ['library cataloging', 'cataloguing', 'bibliographic control'], udc: '025.3', ddc: '025.3', ddcBase: '0253', name: 'Library Cataloging' },
  { keys: ['artificial intelligence', 'machine learning'], udc: '004.8', ddc: '006.3', ddcBase: '0063', name: 'Artificial Intelligence' },
  { keys: ['computer science', 'computing', 'information technology', 'software'], udc: '004', ddc: '004', ddcBase: '004', name: 'Computer Science' },
  { keys: ['mathematics'], udc: '51', ddc: '510', ddcBase: '51', name: 'Mathematics' },
  { keys: ['physics'], udc: '53', ddc: '530', ddcBase: '53', name: 'Physics' },
  { keys: ['chemistry'], udc: '54', ddc: '540', ddcBase: '54', name: 'Chemistry' },
  { keys: ['history', 'civilization'], udc: '93/94', ddc: '900', ddcBase: '90', name: 'History' }
];

const FACET_RULES = [
  { order: 1, pattern: /\b(theory of|philosophy of|principles of)\b/i, udcAdd: '.001', ddcSub: '01', label: 'Point of View (.001) / DDC -01' },
  { order: 3, pattern: /\b(india|indian)\b/i, udcAdd: '(540)', ddcSub: '0954', histDdc: '954', label: 'Place (540) India / DDC -0954' },
  { order: 5, pattern: /\b(handbooks?|manuals?|guides?|guide to|textbooks?|text[- ]books?)\b/i, udcAdd: '(035)', ddcSub: '0202', label: 'Form (035) Guide / DDC -0202' },
  { order: 6, pattern: /\b(in hindi|hindi[- ]language)\b/i, udcAdd: '=214.21', ddcSub: '', label: 'Language (=214.21 Hindi)' }
];

// 4. PURE REAL GOOGLE AI MODE (Strict Gemini API Execution)
async function callGoogleAIMode(query) {
  if (!GEMINI_API_KEY) {
    return { error: 'GEMINI_API_KEY is missing in Render Environment Variables.' };
  }

  const prompt = `You are a senior library cataloger expert in UDC (Universal Decimal Classification) and DDC 23rd Edition.
Build the EXACT synthesized class number for: "${query}".
Follow official UDC signs and citation order strictly:
- Connecting signs: + (addition), / (stroke extension), : (relation), :: (double colon order fixing), [...] (subgrouping), * (non-UDC code), A/Z (alphabetical), ' (special auxiliary).
- Common auxiliaries order: .00/-0 (viewpoint/persons) -> (...) (place, e.g., (540) India) -> "..." (time, e.g., 20th century = "19") -> (0...) (form) -> =... (language).
Return ONLY valid JSON: {"udc": "...", "ddc": "...", "explanation": "step-by-step synthesis breakdown"}`;

  const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  let lastError = '';

  for (const model of models) {
    try {
      const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
        })
      });

      const data = await apiRes.json();
      if (data.error) {
        lastError = `${model}: ${data.error.message}`;
        continue;
      }

      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        const rawText = data.candidates[0].content.parts.map(p => p.text || '').join('');
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.udc && parsed.ddc) {
            return {
              udc: parsed.udc,
              ddc: parsed.ddc,
              explanation: parsed.explanation || 'Synthesized via Gemini API Live.',
              source: '✨ Google AI Mode (Gemini API Live)'
            };
          }
        }
      }
    } catch (e) {
      lastError = `${model}: ${e.message}`;
    }
  }
  return { error: `Gemini API Failed: ${lastError || 'Network timeout or invalid key'}` };
}

// 5. GZIP Response Helper
function sendCompressed(req, res, statusCode, contentType, payload) {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const buf = Buffer.from(payload, 'utf8');
  if (acceptEncoding.includes('gzip')) {
    zlib.gzip(buf, (err, compressed) => {
      if (!err) {
        res.writeHead(statusCode, { 'Content-Type': contentType, 'Content-Encoding': 'gzip', 'Cache-Control': 'public, max-age=3600' });
        return res.end(compressed);
      }
      res.writeHead(statusCode, { 'Content-Type': contentType });
      res.end(buf);
    });
  } else {
    res.writeHead(statusCode, { 'Content-Type': contentType });
    res.end(buf);
  }
}

// 6. Professional Library Cataloger UI
const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>UDC & DDC Classifier • Google AI Mode</title>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: linear-gradient(135deg, #f0f4f9 0%, #e8eef5 100%); margin: 0; padding: 24px 14px; min-height: 100vh; display: flex; justify-content: center; align-items: flex-start; }
    .container { width: 100%; max-width: 740px; background: #ffffff; border-radius: 24px; padding: 28px 24px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); border: 1px solid rgba(255,255,255,0.8); }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-icon { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #1a73e8, #4285f4); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; }
    .brand-title { font-size: 18px; font-weight: 700; color: #1e293b; margin: 0; }
    .brand-sub { font-size: 12px; color: #64748b; margin: 2px 0 0 0; }
    .tabs { display: flex; gap: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; overflow-x: auto; }
    .tab { background: none; border: none; font-size: 14px; font-weight: 600; color: #64748b; cursor: pointer; padding: 6px 2px; position: relative; white-space: nowrap; transition: color 0.2s; }
    .tab:hover { color: #1a73e8; }
    .tab.active { color: #1a73e8; }
    .tab.active::after { content: ""; position: absolute; bottom: -11px; left: 0; width: 100%; height: 3px; background: #1a73e8; border-radius: 3px 3px 0 0; }
    .search-box { display: flex; align-items: center; border: 1.5px solid #cbd5e1; border-radius: 30px; padding: 6px 8px 6px 18px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04); background: #fff; transition: border-color 0.2s, box-shadow 0.2s; }
    .search-box:focus-within { border-color: #1a73e8; box-shadow: 0 4px 14px rgba(26, 115, 232, 0.14); }
    .search-box input { flex: 1; border: none; outline: none; font-size: 15px; color: #0f172a; padding: 10px 4px; background: transparent; }
    .search-box button { background: linear-gradient(135deg, #1a73e8, #1557b0); color: #fff; border: none; border-radius: 24px; padding: 11px 22px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; min-width: 90px; }
    .search-box button:hover { opacity: 0.92; }
    .search-box button:disabled { background: #94a3b8; cursor: not-allowed; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #ffffff; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 6px; }
    .signs-bar { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .sign-pill { font-size: 11px; color: #475569; background: #f1f5f9; padding: 3px 8px; border-radius: 6px; font-family: monospace; }
    .result-card { margin-top: 24px; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; background: #fafbfc; display: none; }
    .badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 20px; background: #e8f0fe; color: #1a73e8; margin-bottom: 16px; }
    .badge.error { background: #fde8e8; color: #c53030; }
    .code-row { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 14px 16px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 10px; }
    .code-label { font-weight: 600; color: #334155; font-size: 14px; }
    .code-actions { display: flex; align-items: center; gap: 8px; }
    .code-val { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 16px; font-weight: 700; color: #0f5132; background: #d1e7dd; padding: 5px 12px; border-radius: 8px; word-break: break-all; }
    .copy-btn { background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; border-radius: 8px; padding: 5px 9px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .copy-btn:hover { background: #e2e8f0; }
    .explanation { margin-top: 12px; font-size: 13.5px; color: #334155; line-height: 1.6; background: #fff; padding: 14px 16px; border-radius: 12px; border-left: 4px solid #1a73e8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div class="brand-icon">LC</div>
        <div>
          <h1 class="brand-title">UDC & DDC Precision Classifier</h1>
          <p class="brand-sub">Google AI Mode Priority • DDC 23 & Complete UDC Synthesis</p>
        </div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" data-mode="ai">✨ AI Mode</button>
      <button class="tab" data-mode="both">All (UDC + DDC)</button>
      <button class="tab" data-mode="udc">UDC Only</button>
      <button class="tab" data-mode="ddc">DDC Only</button>
    </div>

    <div class="search-box">
      <input type="text" id="subjectInput" placeholder="Enter title (e.g., Science and technology)..." />
      <button id="classifyBtn">Search</button>
    </div>

    <div class="signs-bar">
      <span class="sign-pill">+ Addition</span>
      <span class="sign-pill">/ Stroke</span>
      <span class="sign-pill">: Colon</span>
      <span class="sign-pill">:: Double Colon</span>
      <span class="sign-pill">[ ] Subgroup</span>
      <span class="sign-pill">* Code</span>
      <span class="sign-pill">= Language</span>
      <span class="sign-pill">(0...) Form</span>
      <span class="sign-pill">(...) Place</span>
      <span class="sign-pill">(=...) Ethnic</span>
      <span class="sign-pill">"..." Time</span>
      <span class="sign-pill">-05 Persons</span>
      <span class="sign-pill">.00 Viewpoint</span>
    </div>

    <div class="result-card" id="resultCard">
      <span class="badge" id="sourceBadge">✨ Google AI Mode</span>
      <div class="code-row" id="udcRow">
        <span class="code-label">UDC Notation</span>
        <div class="code-actions">
          <span class="code-val" id="udcValue">-</span>
          <button class="copy-btn" onclick="copyText('udcValue', this)">Copy</button>
        </div>
      </div>
      <div class="code-row" id="ddcRow">
        <span class="code-label">DDC 23 Notation</span>
        <div class="code-actions">
          <span class="code-val" id="ddcValue">-</span>
          <button class="copy-btn" onclick="copyText('ddcValue', this)">Copy</button>
        </div>
      </div>
      <div class="explanation" id="explanationText"></div>
    </div>
  </div>
  <script>
    let currentMode = 'ai';
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentMode = tab.dataset.mode;
        updateRowVisibility();
      });
    });
    function updateRowVisibility() {
      document.getElementById('udcRow').style.display = currentMode === 'ddc' ? 'none' : 'flex';
      document.getElementById('ddcRow').style.display = currentMode === 'udc' ? 'none' : 'flex';
    }
    function copyText(id, btn) {
      const val = document.getElementById(id).textContent;
      navigator.clipboard.writeText(val);
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1400);
    }
    function showResult(data) {
      const card = document.getElementById('resultCard');
      card.style.display = 'block';
      const badge = document.getElementById('sourceBadge');
      badge.textContent = data.source || '✨ Google AI Mode';
      if (data.udc === 'ERROR') {
        badge.className = 'badge error';
      } else {
        badge.className = 'badge';
      }
      document.getElementById('udcValue').textContent = data.udc || 'Not found';
      document.getElementById('ddcValue').textContent = data.ddc || 'Not found';
      document.getElementById('explanationText').textContent = data.explanation || '';
      updateRowVisibility();
    }
    async function classifySubject() {
      const query = document.getElementById('subjectInput').value.trim();
      if (!query) return;

      const btn = document.getElementById('classifyBtn');
      btn.innerHTML = '<span class="spinner"></span>Searching...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });
        const data = await res.json();
        showResult(data);
      } catch (err) {
        alert('Connection error. Try again.');
      } finally {
        btn.textContent = 'Search';
        btn.disabled = false;
      }
    }
    document.getElementById('classifyBtn').addEventListener('click', classifySubject);
    document.getElementById('subjectInput').addEventListener('keypress', e => {
      if (e.key === 'Enter') classifySubject();
    });
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    return sendCompressed(req, res, 200, 'text/html; charset=utf-8', HTML_PAGE);
  }

  if (req.method === 'POST' && req.url === '/api/classify') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { query } = JSON.parse(body || '{}');
        if (!query) {
          return sendCompressed(req, res, 400, 'application/json', JSON.stringify({ error: 'Query is required' }));
        }

        const qKey = query.toLowerCase().trim();
        if (diskCache[qKey]) {
          return sendCompressed(req, res, 200, 'application/json', JSON.stringify(diskCache[qKey]));
        }

        // STRICT GEMINI AI MODE CALL
        const aiResult = await callGoogleAIMode(query);
        if (aiResult && aiResult.udc) {
          saveCache(qKey, aiResult);
          return sendCompressed(req, res, 200, 'application/json', JSON.stringify(aiResult));
        } else {
          // Display exact API error on screen so you know why it didn't connect
          const errorMsg = aiResult ? aiResult.error : 'Unknown AI failure';
          return sendCompressed(req, res, 200, 'application/json', JSON.stringify({
            udc: 'ERROR',
            ddc: 'ERROR',
            explanation: `API Connection Failed: ${errorMsg}. Please check your GEMINI_API_KEY in Render Environment variables.`,
            source: '❌ Google AI Mode Error'
          }));
        }
      } catch (err) {
        return sendCompressed(req, res, 200, 'application/json', JSON.stringify({
          udc: 'ERROR',
          ddc: 'ERROR',
          explanation: `Server Exception: ${err.message}`,
          source: '❌ Server Exception'
        }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
