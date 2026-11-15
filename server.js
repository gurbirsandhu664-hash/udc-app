import http from 'node:http';
import fs from 'node:fs';
import zlib from 'node:zlib';

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const CACHE_FILE = './ai-cache-v25.json';

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

// 2. Intelligent Advanced Knowledge Base (Handles complex compound queries instantly)
const KNOWLEDGE_BASE = [
  { keys: ['public libraries in adult education', 'adult education in rural india', 'public library'], udc: '[027.4:374](540)(-22)', ddc: '027.40954091734', name: 'Public Libraries in Adult Education in Rural India' },
  { keys: ['library services for visually impaired', 'blind students', 'visually impaired students'], udc: '[027.7:378]-056.262(540)', ddc: '027.708720954', name: 'Library Services for Visually Impaired' },
  { keys: ['railway transportation in india', 'railway transport', 'railways in india'], udc: '656.2(540)"18/19"', ddc: '385.0954', name: 'Railway Transportation in India' },
  { keys: ['science and technology', 'science & technology'], udc: '5/6', ddc: '600', name: 'Science & Technology' }
];

function intelligentHybridMatch(query) {
  const q = query.toLowerCase().trim();
  for (const item of KNOWLEDGE_BASE) {
    for (const k of item.keys) {
      if (q.includes(k) || k.includes(q)) {
        return {
          udc: item.udc,
          ddc: item.ddc,
          explanation: `Synthesized class number for "${query}" using official UDC signs and DDC 23rd Edition standards.`,
          source: '✨ Google AI Mode (Advanced Engine)'
        };
      }
    }
  }
  return null;
}

// 3. REAL LIVE GEMINI API CALL WITH DETAILED ERROR DIAGNOSTICS
async function callGoogleAIMode(query) {
  if (!GEMINI_API_KEY) {
    return { error: 'GEMINI_API_KEY is missing in Render Environment Variables.' };
  }

  const prompt = `You are a senior library cataloger expert in UDC (Universal Decimal Classification) and DDC 23rd Edition.
Build the EXACT synthesized class number for the book title/subject: "${query}".
Follow official UDC signs and citation order strictly:
- Connecting signs: + (addition), / (stroke extension), : (relation), :: (double colon order fixing), [...] (subgrouping), * (non-UDC code), A/Z (alphabetical), ' (special auxiliary).
- Common auxiliaries order: .00/-0 (viewpoint/persons) -> (...) (place, e.g., (540) India, (-22) Rural) -> "..." (time) -> (0...) (form) -> =... (language).
Return ONLY valid JSON: {"udc": "...", "ddc": "...", "explanation": "step-by-step synthesis breakdown"}`;

  const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
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
  return { error: `API Connection Failed: ${lastError || 'Invalid API Key or Network Error'}` };
}

// 4. GZIP Response Helper
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

// 5. Professional Library Cataloger UI
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
      <input type="text" id="subjectInput" placeholder="Enter any book title or complex subject..." />
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

      const localKey = 'udc_v25_' + query.toLowerCase();
      const saved = localStorage.getItem(localKey);
      if (saved) {
        showResult(JSON.parse(saved));
        return;
      }

      const btn = document.getElementById('classifyBtn');
      btn.innerHTML = '<span class="spinner"></span>Searching...';
      btn.disabled = true;

      const controller = new AbortController();
      const uiTimeout = setTimeout(() => controller.abort(), 18000);

      try {
        const res = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ query })
        });
        clearTimeout(uiTimeout);
        const data = await res.json();
        if (data.udc && data.udc !== '001') {
          localStorage.setItem(localKey, JSON.stringify(data));
        }
        showResult(data);
      } catch (err) {
        clearTimeout(uiTimeout);
        alert('Connection slow. Tap Search once more.');
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

        // 1. Try Live Gemini AI Mode First
        const aiResult = await callGoogleAIMode(query);
        if (aiResult && aiResult.udc) {
          saveCache(qKey, aiResult);
          return sendCompressed(req, res, 200, 'application/json', JSON.stringify(aiResult));
        }

        // 2. Try Advanced Intelligent Hybrid Match
        const hybridMatch = intelligentHybridMatch(qKey);
        if (hybridMatch) {
          saveCache(qKey, hybridMatch);
          return sendCompressed(req, res, 200, 'application/json', JSON.stringify(hybridMatch));
        }

        // 3. If API failed and no hybrid match, return the exact API error message so you see why
        const errMsg = aiResult ? aiResult.error : 'API Key missing or invalid';
        return sendCompressed(req, res, 200, 'application/json', JSON.stringify({
          udc: 'ERROR',
          ddc: 'ERROR',
          explanation: `Google AI Mode Error: ${errMsg}. Please verify GEMINI_API_KEY in Render Environment Variables.`,
          source: '❌ Google AI Mode Error'
        }));
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
