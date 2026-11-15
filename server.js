const http = process.getBuiltinModule('node:http');
const fs = process.getBuiltinModule('node:fs');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CACHE_FILE = './ai-cache.json';

// 1. Persistent Disk Cache (Survives Render Restarts - Never Wastes Quota Twice)
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

// 2. Load & Flatten Local Reference Indexes (0 Quota Used)
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

// 3. Comprehensive Built-in UDC & DDC Core Dictionary (0 Quota, Instant)
const CORE_SUBJECTS = {
  'computer science': { udc: '004', ddc: '004', exp: 'Computer Science, Data Processing & Computing.' },
  'artificial intelligence': { udc: '004.8', ddc: '006.3', exp: 'Artificial Intelligence & Machine Learning.' },
  'library science': { udc: '02', ddc: '020', exp: 'Library & Information Sciences.' },
  'journalism': { udc: '070', ddc: '070', exp: 'News Media, Journalism & Publishing.' },
  'philosophy': { udc: '1', ddc: '100', exp: 'General Philosophy & Metaphysics.' },
  'psychology': { udc: '159.9', ddc: '150', exp: 'Psychology (UDC 159.9; DDC 150).' },
  'logic': { udc: '16', ddc: '160', exp: 'Logic & Reasoning.' },
  'ethics': { udc: '17', ddc: '170', exp: 'Moral Philosophy & Ethics.' },
  'religion': { udc: '2', ddc: '200', exp: 'Religion & Theology.' },
  'sikhism': { udc: '294.553', ddc: '294.6', exp: 'Sikhism & Sikh Studies.' },
  'hinduism': { udc: '294.5', ddc: '294.5', exp: 'Hinduism.' },
  'islam': { udc: '297', ddc: '297', exp: 'Islam.' },
  'christianity': { udc: '22/28', ddc: '230', exp: 'Christianity & Christian Theology.' },
  'social sciences': { udc: '3', ddc: '300', exp: 'Social Sciences.' },
  'sociology': { udc: '316', ddc: '301', exp: 'Sociology & Society (UDC Class 316; DDC 301).' },
  'statistics': { udc: '311', ddc: '310', exp: 'Statistical Science.' },
  'political science': { udc: '32', ddc: '320', exp: 'Political Science & Politics (UDC Class 32; DDC 320).' },
  'politics': { udc: '32', ddc: '320', exp: 'Political Science & Government.' },
  'international relations': { udc: '327', ddc: '327', exp: 'International Relations & Foreign Policy.' },
  'economics': { udc: '33', ddc: '330', exp: 'Economics & Economic Science.' },
  'banking': { udc: '336.71', ddc: '332.1', exp: 'Banks & Banking Finance.' },
  'law': { udc: '34', ddc: '340', exp: 'Law & Jurisprudence.' },
  'constitutional law': { udc: '342', ddc: '342', exp: 'Constitutional & Administrative Law.' },
  'criminal law': { udc: '343', ddc: '345', exp: 'Criminal Law & Criminology.' },
  'public administration': { udc: '35', ddc: '350', exp: 'Public Administration & Government.' },
  'education': { udc: '37', ddc: '370', exp: 'Education & Teaching.' },
  'commerce': { udc: '339', ddc: '380', exp: 'Commerce, Trade & Communications.' },
  'mathematics': { udc: '51', ddc: '510', exp: 'Mathematics.' },
  'algebra': { udc: '512', ddc: '512', exp: 'Algebra & Number Theory.' },
  'geometry': { udc: '514', ddc: '516', exp: 'Geometry.' },
  'astronomy': { udc: '52', ddc: '520', exp: 'Astronomy & Astrophysics.' },
  'physics': { udc: '53', ddc: '530', exp: 'Physics.' },
  'quantum physics': { udc: '530.145', ddc: '530.12', exp: 'Quantum Mechanics & Quantum Theory.' },
  'chemistry': { udc: '54', ddc: '540', exp: 'Chemistry & Mineralogy.' },
  'organic chemistry': { udc: '547', ddc: '547', exp: 'Organic Chemistry.' },
  'geology': { udc: '55', ddc: '551', exp: 'Earth Sciences & Geology.' },
  'biology': { udc: '57', ddc: '570', exp: 'Biological Sciences.' },
  'genetics': { udc: '575', ddc: '576.5', exp: 'Genetics & Evolution.' },
  'botany': { udc: '58', ddc: '580', exp: 'Botany & Plant Sciences.' },
  'zoology': { udc: '59', ddc: '590', exp: 'Zoology & Animal Sciences.' },
  'medicine': { udc: '61', ddc: '610', exp: 'Medical Sciences & Medicine.' },
  'anatomy': { udc: '611', ddc: '611', exp: 'Human Anatomy.' },
  'physiology': { udc: '612', ddc: '612', exp: 'Human Physiology.' },
  'pharmacology': { udc: '615', ddc: '615', exp: 'Pharmacology & Therapeutics.' },
  'cardiology': { udc: '616.12', ddc: '616.12', exp: 'Diseases of Heart & Cardiology.' },
  'surgery': { udc: '617', ddc: '617', exp: 'Surgery & Regional Medicine.' },
  'engineering': { udc: '62', ddc: '620', exp: 'Engineering & Technology.' },
  'mechanical engineering': { udc: '621', ddc: '621', exp: 'Mechanical Engineering.' },
  'electrical engineering': { udc: '621.3', ddc: '621.3', exp: 'Electrical & Electronic Engineering.' },
  'civil engineering': { udc: '624', ddc: '624', exp: 'Civil & Structural Engineering.' },
  'vehicles': { udc: '629', ddc: '629.2', exp: 'Transport Vehicle Engineering & Motor Vehicles.' },
  'automobiles': { udc: '629.33', ddc: '629.222', exp: 'Automobiles & Motor Cars.' },
  'agriculture': { udc: '63', ddc: '630', exp: 'Agriculture & Agronomy.' },
  'management': { udc: '65', ddc: '658', exp: 'Management & Business Organization.' },
  'accounting': { udc: '657', ddc: '657', exp: 'Accounting & Bookkeeping.' },
  'architecture': { udc: '72', ddc: '720', exp: 'Architecture.' },
  'music': { udc: '78', ddc: '780', exp: 'Music.' },
  'sports': { udc: '796', ddc: '796', exp: 'Athletic & Outdoor Sports.' },
  'linguistics': { udc: '81', ddc: '410', exp: 'Linguistics & Languages.' },
  'english literature': { udc: '821.111', ddc: '820', exp: 'English Literature.' },
  'punjabi literature': { udc: '821.214.2', ddc: '891.42', exp: 'Punjabi Literature.' },
  'literature': { udc: '82', ddc: '800', exp: 'General Literature & Rhetoric.' },
  'geography': { udc: '91', ddc: '910', exp: 'Geography & Travel.' },
  'history': { udc: '93/94', ddc: '900', exp: 'General History.' },
  'indian history': { udc: '94(540)', ddc: '954', exp: 'History of India.' }
};

function findZeroQuotaMatch(query) {
  const q = query.toLowerCase().trim();

  // Exact Core Match
  if (CORE_SUBJECTS[q]) {
    return {
      udc: CORE_SUBJECTS[q].udc,
      ddc: CORE_SUBJECTS[q].ddc,
      explanation: CORE_SUBJECTS[q].exp,
      source: '⚡ Verified Reference (0 Quota Used)'
    };
  }

  // Exact Local JSON Match
  const udcExact = flatUdc.get(q);
  const ddcExact = flatDdc.get(q);
  if (udcExact || ddcExact) {
    return {
      udc: udcExact || 'See DDC',
      ddc: ddcExact || 'See UDC',
      explanation: `Exact match found in project reference index for "${query}".`,
      source: '⚡ Local Index (0 Quota Used)'
    };
  }

  // Smart Partial / Keyword Match in Core Subjects (Saves Quota on variations)
  for (const [key, val] of Object.entries(CORE_SUBJECTS)) {
    if (q.includes(key) || (q.length > 4 && key.includes(q))) {
      return {
        udc: val.udc,
        ddc: val.ddc,
        explanation: `${val.exp} (Matched closest subject: ${key})`,
        source: '⚡ Smart Local Match (0 Quota Used)'
      };
    }
  }

  // Partial Match in Local JSON Indexes
  for (const [k, uVal] of flatUdc.entries()) {
    if (k.includes(q) && q.length >= 4) {
      const dVal = flatDdc.get(k) || 'See UDC';
      return {
        udc: uVal,
        ddc: dVal,
        explanation: `Matched "${k}" in local reference index.`,
        source: '⚡ Local Index (0 Quota Used)'
      };
    }
  }

  return null;
}

// 4. Multi-Model Gemini Caller (Automatic Fallback if one model hits quota)
async function callGeminiWithFallback(prompt) {
  const models = ['gemini-3.8-flash', 'gemini-2.5-flash-lite'];
  for (const model of models) {
    try {
      const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      });
      const data = await apiRes.json();
      if (!data.error && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return JSON.parse(data.candidates[0].content.parts[0].text);
      }
    } catch (e) {}
  }
  return null;
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
      <input type="text" id="subjectInput" placeholder="Enter subject (e.g., Political Science, Sociology, Cardiology)..." />
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

        // 1. Check Persistent Disk Cache (0 Quota)
        if (diskCache[qKey]) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(diskCache[qKey]));
        }

        // 2. Check Local JSON + Core Subject Dictionary (0 Quota)
        const zeroQuotaHit = findZeroQuotaMatch(qKey);
        if (zeroQuotaHit) {
          saveCache(qKey, zeroQuotaHit);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(zeroQuotaHit));
        }

        // 3. Call AI Mode with Automatic Model Fallback
        if (GEMINI_API_KEY) {
          const prompt = `Provide the exact Universal Decimal Classification (UDC) number and Dewey Decimal Classification (DDC 23rd ed.) number for: "${query}".
Return strictly JSON: {"udc": "...", "ddc": "...", "explanation": "short 1-sentence hierarchy"}`;

          const aiParsed = await callGeminiWithFallback(prompt);
          if (aiParsed && (aiParsed.udc || aiParsed.ddc)) {
            const finalResult = {
              udc: aiParsed.udc || '0 (Generalities)',
              ddc: aiParsed.ddc || '000 (Generalities)',
              explanation: aiParsed.explanation || `Classified "${query}" using AI Mode.`,
              source: '✨ Google AI Mode'
            };
            saveCache(qKey, finalResult);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(finalResult));
          }
        }

        // 4. Never-Fail Fallback (Even if API quota hits 0, never shows "Error")
        const safeFallback = {
          udc: '001',
          ddc: '001',
          explanation: `General Knowledge & Interdisciplinary Subject ("${query}"). Try searching a broader discipline (e.g., Sociology, Medicine, Engineering, History).`,
          source: '🛡️ Offline Fallback (0 Quota)'
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(safeFallback));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          udc: '001',
          ddc: '001',
          explanation: 'General Knowledge classification.',
          source: '🛡️ Offline Fallback'
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
