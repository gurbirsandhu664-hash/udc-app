const express = require('express');
const fs = require('fs');

const app = express();
app.use(express.json());

// Render Environment Variables vich payi GEMINI_API_KEY
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
} catch (e) {
  console.log('Local index skipped.');
}

// 2. Server Cache + Rate Limiter (Quota Protection)
const responseCache = new Map();
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 12; // Max 12 searches per minute per user
  const records = (rateLimitMap.get(ip) || []).filter(t => now - t < windowMs);
  if (records.length >= maxRequests) return true;
  records.push(now);
  rateLimitMap.set(ip, records);
  return false;
}

// 3. Google AI Mode Clean UI (Vaddu Boxes Removed)
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
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
      <input type="text" id="subjectInput" placeholder="Ask anything or enter subject (e.g., Quantum Physics, Heart Surgery)..." />
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
</html>`);
});

// 4. Classification API
app.post('/api/classify', async (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      udc: 'Limit Reached',
      ddc: 'Limit Reached',
      explanation: 'Quota protection: Please wait 1 minute before searching again.',
      source: '🛡️ Rate Limit Active'
    });
  }

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  const qKey = query.toLowerCase().trim();

  // Check Cache First (0 Quota)
  if (responseCache.has(qKey)) {
    return res.json(responseCache.get(qKey));
  }

  // Check Local JSON Indexes First (0 Quota)
  if (udcIndex[qKey] && ddcIndex[qKey]) {
    const localResult = {
      udc: udcIndex[qKey],
      ddc: ddcIndex[qKey],
      explanation: `Exact match from local UDC & DDC reference index for "${query}".`,
      source: '⚡ Local Index (0 Quota Used)'
    };
    responseCache.set(qKey, localResult);
    return res.json(localResult);
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      udc: 'Missing Key',
      ddc: 'Missing Key',
      explanation: 'GEMINI_API_KEY not found in Render Environment Variables.',
      source: '⚠️ Config Error'
    });
  }

  // Call Gemini AI Mode with Google Search Grounding (Native Fetch - No Extra NPM Needed)
  try {
    const prompt = `You are an expert library cataloger. Find the exact Universal Decimal Classification (UDC) number and Dewey Decimal Classification (DDC 23rd edition) number for the subject: "${query}".
Verify the classification numbers using Google Search. Do not guess or invent notation.
Respond strictly in valid JSON format with keys: "udc", "ddc", and "explanation" (1-2 clear sentences explaining the subject hierarchy).`;

    const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
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

    const rawText = data.candidates[0].content.parts[0].text;
    const cleanJson = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    const finalResult = {
      udc: parsed.udc || 'Verify manually',
      ddc: parsed.ddc || 'Verify manually',
      explanation: parsed.explanation || '',
      source: '✨ Google AI Mode (Search Grounded)'
    };

    responseCache.set(qKey, finalResult);
    res.json(finalResult);

  } catch (error) {
    console.error('AI Mode Error:', error.message);
    res.status(500).json({
      udc: 'Error',
      ddc: 'Error',
      explanation: error.message || 'API error occurred.',
      source: '⚠️ Fallback'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
