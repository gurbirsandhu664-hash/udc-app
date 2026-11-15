const http = process.getBuiltinModule('node:http');
const fs = process.getBuiltinModule('node:fs');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 1. Local Reference Indexes (0 Quota Used)
let ddcIndex = {};
let udcIndex = {};
try {
  if (fs.existsSync('./ddc-23-reference-index.json')) {
    ddcIndex = JSON.parse(fs.readFileSync('./ddc-23-reference-index.json', 'utf8'));
  }
  if (fs.existsSync('./udc-1961-reference-index.json')) {
    udcIndex = JSON.parse(fs.readFileSync('./udc-1961-reference-index.json', 'utf8'));
  }
} catch (e) {}

// 2. Cache + Rate Limit (Quota Protection)
const responseCache = new Map();
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const records = (rateLimitMap.get(ip) || []).filter(t => now - t < 60000);
  if (records.length >= 12) return true;
  records.push(now);
  rateLimitMap.set(ip, records);
  return false;
}

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>UDC & DDC Classifier - Google AI Mode</title>
  <style>
    * { box-sizing: border-box; font-family: 'Segoe UI', Roboto, Arial, sans-serif; }
    body { background: #f8f9fa; margin: 0; padding: 24px 16px; display: flex; justify-content: center; }
    .container { width: 100%; max-width: 720px; background: #fff; border-radius: 20px; padding: 24px; box-shadow: 0 2px 14px rgba(0,0,0,0.08); }
    .tabs { display: flex; gap: 22px; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px; margin-bottom: 20px; overflow-x: auto; }
    .tab { background: none; border: none; font-size: 15px; font-weight: 500; color: #5f6368; cursor: pointer; padding: 6px 2px; position: relative; white-space: nowrap; }
    .tab.active { color: #1a73e8; font-weight: 600; }
    .tab.active::after { content: ""; position: absolute; bottom: -11px; left: 0; width: 100%; height: 3px; background: #1a73e8; border-radius: 3px 3px 0 0; }
    .search-box { display: flex; align-items: center; border: 1px solid #dfe1e5; border-radius: 28px; padding: 6px 14px; box-shadow: 0 1px 6px rgba(32,33,36,0.12); background: #fff; }
    .search-box input { flex: 1; border: none; outline: none; font-size: 16px; padding: 10px; }
    .search-box button { background: #1a73e8; color: #fff; border: none; border-radius: 20px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .search-box button:hover { background: #1557b0; }
    .search-box button:disabled { background: #9aa0a6; cursor: not-allowed; }
    .result-card { margin-top: 24px; border: 1px solid #e0e0e0; border-radius: 14px; padding: 20px; display: none; }
    .badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 12px; background: #e8f0fe; color: #1a73e8; margin-bottom: 14px; }
    .code-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1f3f4; }
    .code-row:last-of-type { border-bottom: none; }
    .code-label { font-weight: 600; color: #3c4043; font-size: 15px; }
    .code-val { font-family: monospace; font-size: 17px; font-weight: 700; color: #0d652d; background: #e6f4ea; padding: 4px 10px; border-radius: 6px; }
    .explanation { margin-top: 14px; font-size: 14px; color: #3c4043; line-height: 1.6; background: #f8f9fa; padding: 14px; border-radius: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="tabs">
      <button class="tab active" data-mode="ai">✨ AI Mode</button>
      <button class="tab" data-mode="both">All (UDC + DDC)</button>
      <button class="tab" data-mode="udc">UDC Only</button>
      <button class="tab" data-mode="ddc">DDC Only</button>
    </div>
    <div class="search-box">
      <input type="text" id="subjectInput" placeholder="Ask anything or enter subject (e.g., Sociology, Quantum Physics)..." />
      <button id="classifyBtn">Search</button>
    </div>
    <div class="result-card" id="resultCard">
      <span class="badge" id="sourceBadge">✨ Google AI Mode</span>
      <div class="code-row" id="udcRow">
        <span class="code-label">UDC Number</span>
        <span class="code-val" id="udcValue">-</span>
      </div>
      <div class="code-row" id="ddcRow">
        <span class="code-label">DDC Number</span>
        <span class="code-val" id="ddcValue">-</span>
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
    async function classifySubject() {
      const query = document.getElementById('subjectInput').value.trim();
      if (!query) return;
      const btn = document.getElementById('classifyBtn');
      btn.textContent = 'Searching...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });
        const data = await res.json();
        document.getElementById('resultCard').style.display = 'block';
        document.getElementById('sourceBadge').textContent = data.source || '✨ Google AI Mode';
        document.getElementById('udcValue').textContent = data.udc || 'Not found';
        document.getElementById('ddcValue').textContent = data.ddc || 'Not found';
        document.getElementById('explanationText').textContent = data.explanation || '';
        updateRowVisibility();
      } catch (err) {
        alert('Error fetching classification.');
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
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(HTML_PAGE);
  }

  if (req.method === 'POST' && req.url === '/api/classify') {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (isRateLimited(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        udc: 'Limit Reached',
        ddc: 'Limit Reached',
        explanation: 'Quota protection: Please wait 1 minute before searching again.',
        source: '🛡️ Rate Limit Active'
      }));
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { query } = JSON.parse(body || '{}');
        if (!query) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Query is required' }));
        }

        const qKey = query.toLowerCase().trim();
        if (responseCache.has(qKey)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(responseCache.get(qKey)));
        }

        if (udcIndex[qKey] && ddcIndex[qKey]) {
          const localResult = {
            udc: udcIndex[qKey],
            ddc: ddcIndex[qKey],
            explanation: `Exact match from local UDC & DDC reference index for "${query}".`,
            source: '⚡ Local Index (0 Quota Used)'
          };
          responseCache.set(qKey, localResult);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(localResult));
        }

        if (!GEMINI_API_KEY) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            udc: 'Missing Key',
            ddc: 'Missing Key',
            explanation: 'GEMINI_API_KEY not found in Render Environment Variables.',
            source: '⚠️ Config Error'
          }));
        }

        const prompt = `You are an expert library cataloger. Find the exact Universal Decimal Classification (UDC) number and Dewey Decimal Classification (DDC 23rd edition) number for the subject: "${query}".
Verify the classification numbers using Google Search. Do not guess or invent notation.
Respond strictly in valid JSON format with keys: "udc", "ddc", and "explanation" (1-2 clear sentences explaining the subject hierarchy).`;

        // Updated to models/gemini-3.8-flash per API error notice
        const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
            generationConfig: { temperature: 0.1 }
          })
        });

        const data = await apiRes.json();
        if (data.error) throw new Error(data.error.message);

        const parts = data.candidates?.[0]?.content?.parts || [];
        const rawText = parts.map(p => p.text || '').join('');
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Invalid JSON returned by model');
        
        const parsed = JSON.parse(jsonMatch[0]);

        const finalResult = {
          udc: parsed.udc || 'Verify manually',
          ddc: parsed.ddc || 'Verify manually',
          explanation: parsed.explanation || '',
          source: '✨ Google AI Mode (Search Grounded)'
        };

        responseCache.set(qKey, finalResult);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(finalResult));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          udc: 'Error',
          ddc: 'Error',
          explanation: err.message || 'API error occurred.',
          source: '⚠️ Fallback'
        }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
