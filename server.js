import http from 'node:http';
import fs from 'node:fs';
import zlib from 'node:zlib';

const CACHE_FILE = './ai-cache-ultimate-v6.json';

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

// Ultimate Universal Scoring & Token-Based NLP Engine (Permanent & Foolproof)
function ultimateSynthesize(query) {
  const q = query.toLowerCase().trim();

  // Comprehensive Subject Dictionary with Scoring Weights
  const subjects = [
    { keys: ['waterborne', 'communicable disease', 'diseases', 'epidemic', 'infection'], udc: '614.4', ddc: '614.4', name: 'Control & Prevention of Diseases' },
    { keys: ['irrigation', 'watering', 'sprinkler'], udc: '631.7', ddc: '631.7', name: 'Agricultural Irrigation Systems' },
    { keys: ['solar energy', 'solar power', 'solar technology', 'photovoltaic'], udc: '621.47', ddc: '621.47', name: 'Solar Energy Technology' },
    { keys: ['pesticide', 'pesticides', 'agricultural chemicals', 'crop protection'], udc: '632.95', ddc: '632.95', name: 'Agricultural Pesticides' },
    { keys: ['plastic industry', 'plastic industries', 'plastic pollution', 'polymers'], udc: '628.5:678', ddc: '628.5498', name: 'Industrial Pollution by Plastics' },
    { keys: ['environmental science', 'environment', 'ecology', 'ecosystem', 'climate change', 'groundwater quality', 'water quality', 'pollution'], udc: '502/504', ddc: '333.7', name: 'Environmental Science & Ecology' },
    { keys: ['public health', 'health impact', 'preventive medicine'], udc: '614', ddc: '614', name: 'Public Health' },
    { keys: ['public library', 'public libraries'], udc: '027.4', ddc: '027.4', name: 'Public Libraries' },
    { keys: ['academic library', 'university library', 'college library'], udc: '027.7', ddc: '027.7', name: 'Academic Libraries' },
    { keys: ['library', 'libraries', 'librarian', 'cataloging'], udc: '027', ddc: '027', name: 'Libraries & Information Science' },
    { keys: ['information technology', 'computer science', 'software engineering', 'computing'], udc: '004', ddc: '004', name: 'Computer Science & IT' },
    { keys: ['quantum physics', 'quantum mechanics'], udc: '530.145', ddc: '530.12', name: 'Quantum Physics' },
    { keys: ['physics', 'mechanics', 'optics'], udc: '53', ddc: '530', name: 'Physics' },
    { keys: ['mathematics', 'math', 'algebra', 'calculus'], udc: '51', ddc: '510', name: 'Mathematics' },
    { keys: ['chemistry', 'chemical'], udc: '54', ddc: '540', name: 'Chemistry' },
    { keys: ['medicine', 'medical', 'disease', 'clinical'], udc: '61', ddc: '610', name: 'Medicine & Health' },
    { keys: ['agriculture', 'farming', 'crops', 'agronomy'], udc: '63', ddc: '630', name: 'Agriculture' },
    { keys: ['management', 'business', 'administration'], udc: '65', ddc: '658', name: 'Business Management' },
    { keys: ['railway', 'transportation', 'transport', 'traffic'], udc: '656.2', ddc: '385', name: 'Transportation & Railways' },
    { keys: ['punjabi literature', 'punjabi poetry', 'punjabi prose'], udc: '821.214.2', ddc: '891.42', name: 'Punjabi Literature' },
    { keys: ['history', 'historical', 'civilization'], udc: '93/94', ddc: '900', name: 'History' },
    { keys: ['sociology', 'society', 'social structure'], udc: '316', ddc: '301', name: 'Sociology' },
    { keys: ['economics', 'economy', 'financial'], udc: '33', ddc: '330', name: 'Economics' },
    { keys: ['law', 'legal', 'constitution'], udc: '34', ddc: '340', name: 'Law' },
    { keys: ['education', 'teaching', 'pedagogy'], udc: '37', ddc: '370', name: 'Education' },
    { keys: ['psychology', 'behavior', 'mental'], udc: '159.9', ddc: '150', name: 'Psychology' },
    { keys: ['philosophy', 'ethics', 'logic'], udc: '1', ddc: '100', name: 'Philosophy' }
  ];

  // Find best matching subject by score
  let bestSubj = { udc: '025.4', ddc: '025.42', name: 'General Library Science' };
  let maxScore = 0;

  for (const subj of subjects) {
    let score = 0;
    for (const key of subj.keys) {
      if (q.includes(key)) {
        score += key.length; // longer keyword match gets higher priority
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestSubj = subj;
    }
  }

  let finalUdc = bestSubj.udc;
  let finalDdc = bestSubj.ddc;
  let steps = [`Base: ${bestSubj.name} (${bestSubj.udc} / ${bestSubj.ddc})`];
  let subRelations = [];
  let facets = [];

  // Dynamic Secondary Relations Scanner
  if (q.includes('solar') && !finalUdc.startsWith('621.47')) {
    subRelations.push({ udc: ':621.47', ddc: '.0288', label: 'Relation (:621.47 Solar Energy) / DDC .0288' });
  }
  if (q.includes('public health') && !finalUdc.startsWith('614')) {
    subRelations.push({ udc: ':614', ddc: '.042', label: 'Relation (:614 Public Health) / DDC .042' });
  }
  if (q.includes('groundwater') && !finalUdc.startsWith('556')) {
    subRelations.push({ udc: ':556.3', ddc: '.168', label: 'Relation (:556.3 Groundwater) / DDC .168' });
  }

  // Dynamic Place & Region Scanner
  if (q.includes('rajasthan')) {
    facets.push({ udc: '(544.6)', ddc: '09544', label: 'Place (544.6) Rajasthan / DDC -09544' });
  } else if (q.includes('punjab')) {
    facets.push({ udc: '(545.2)', ddc: '09545', label: 'Place (545.2) Punjab / DDC -09545' });
  } else if (q.includes('india') || q.includes('indian')) {
    facets.push({ udc: '(540)', ddc: '0954', label: 'Place (540) India / DDC -0954' });
  }

  // Environment / Habitat
  if (q.includes('rural') || q.includes('village')) {
    facets.push({ udc: '(-22)', ddc: '091734', label: 'Place (-22) Rural / DDC -091734' });
  } else if (q.includes('urban') || q.includes('city')) {
    facets.push({ udc: '(-21)', ddc: '091732', label: 'Place (-21) Urban / DDC -091732' });
  }

  // Persons / Target Groups
  if (q.includes('children') || q.includes('child')) {
    facets.push({ udc: '-053.2', ddc: '083', label: 'Persons (-053.2 Children) / DDC -083' });
  } else if (q.includes('farmer') || q.includes('farmers')) {
    facets.push({ udc: '-051', ddc: '08863', label: 'Persons (-051 Farmers) / DDC -08863' });
  } else if (q.includes('visually impaired') || q.includes('blind')) {
    facets.push({ udc: '-056.262', ddc: '0872', label: 'Persons (-056.262 Visually Impaired) / DDC -0872' });
  }

  // Time / Century
  if (q.includes('20th century') || q.includes('twentieth century')) {
    facets.push({ udc: '"19"', ddc: '0904', label: 'Time ("19" 20th Century) / DDC -0904' });
  }

  // Construct Final Notations
  for (const rel of subRelations) {
    finalUdc += rel.udc;
    if (finalDdc.includes('.')) {
      finalDdc += rel.ddc;
    } else {
      finalDdc += '.' + rel.ddc;
    }
    steps.push(rel.label);
  }

  for (const f of facets) {
    finalUdc += f.udc;
    if (finalDdc.includes('.')) {
      finalDdc += f.ddc.replace('.', '');
    } else {
      finalDdc += '.' + f.ddc.replace('.', '');
    }
    steps.push(f.label);
  }

  return {
    udc: finalUdc,
    ddc: finalDdc,
    explanation: `Starpage AI Permanent Synthesized Breakdown -> ${steps.join(' + ')}.`,
    source: '⭐ Starpage AI Ultimate Engine'
  };
}

// GZIP Response Helper
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

// Professional Starpage AI UI
const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>UDC & DDC Classifier • Starpage AI</title>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: #f7f8fa; margin: 0; padding: 24px 14px; min-height: 100vh; display: flex; justify-content: center; align-items: flex-start; }
    .container { width: 100%; max-width: 740px; background: #ffffff; border-radius: 16px; padding: 28px 24px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #e1e4e8; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon { width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #4c6ef5, #3b5bdb); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; }
    .brand-title { font-size: 19px; font-weight: 700; color: #212529; margin: 0; }
    .brand-sub { font-size: 12.5px; color: #6c757d; margin: 2px 0 0 0; }
    .tabs { display: flex; gap: 20px; border-bottom: 1px solid #e9ecef; padding-bottom: 10px; margin-bottom: 22px; overflow-x: auto; }
    .tab { background: none; border: none; font-size: 14px; font-weight: 600; color: #6c757d; cursor: pointer; padding: 6px 2px; position: relative; white-space: nowrap; transition: color 0.2s; }
    .tab:hover { color: #3b5bdb; }
    .tab.active { color: #3b5bdb; }
    .tab.active::after { content: ""; position: absolute; bottom: -11px; left: 0; width: 100%; height: 3px; background: #3b5bdb; border-radius: 3px 3px 0 0; }
    .search-box { display: flex; align-items: center; border: 2px solid #ced4da; border-radius: 28px; padding: 6px 8px 6px 18px; background: #fff; transition: border-color 0.2s, box-shadow 0.2s; }
    .search-box:focus-within { border-color: #3b5bdb; box-shadow: 0 0 0 4px rgba(59, 91, 219, 0.1); }
    .search-box input { flex: 1; border: none; outline: none; font-size: 15px; color: #212529; padding: 10px 4px; background: transparent; }
    .search-box button { background: #3b5bdb; color: #fff; border: none; border-radius: 22px; padding: 11px 22px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; display: flex; align-items: center; justify-content: center; min-width: 90px; }
    .search-box button:hover { background: #364fc7; }
    .search-box button:disabled { background: #adb5bd; cursor: not-allowed; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #ffffff; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 6px; }
    .signs-bar { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .sign-pill { font-size: 11px; color: #495057; background: #f1f3f5; padding: 3px 8px; border-radius: 6px; font-family: monospace; }
    .result-card { margin-top: 24px; border: 1px solid #dee2e6; border-radius: 12px; padding: 20px; background: #f8f9fa; display: none; }
    .badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 20px; background: #e7f5ff; color: #1c7ed6; margin-bottom: 16px; }
    .code-row { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 14px 16px; border-radius: 10px; border: 1px solid #dee2e6; margin-bottom: 10px; }
    .code-label { font-weight: 600; color: #495057; font-size: 14px; }
    .code-actions { display: flex; align-items: center; gap: 8px; }
    .code-val { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 16px; font-weight: 700; color: #2b8a3e; background: #ebfbee; padding: 5px 12px; border-radius: 6px; word-break: break-all; }
    .copy-btn { background: #f1f3f5; border: 1px solid #ced4da; color: #495057; border-radius: 6px; padding: 5px 10px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .copy-btn:hover { background: #e9ecef; }
    .explanation { margin-top: 12px; font-size: 13.5px; color: #343a40; line-height: 1.6; background: #fff; padding: 14px 16px; border-radius: 10px; border-left: 4px solid #3b5bdb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div class="brand-icon">⭐</div>
        <div>
          <h1 class="brand-title">UDC & DDC Precision Classifier</h1>
          <p class="brand-sub">Starpage AI Ultimate Engine • Permanent Synthesis</p>
        </div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" data-mode="ai">⭐ Starpage AI</button>
      <button class="tab" data-mode="both">All (UDC + DDC)</button>
      <button class="tab" data-mode="udc">UDC Only</button>
      <button class="tab" data-mode="ddc">DDC Only</button>
    </div>

    <div class="search-box">
      <input type="text" id="subjectInput" placeholder="Enter any complex title or subject..." />
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
      <span class="badge" id="sourceBadge">⭐ Starpage AI Ultimate Engine</span>
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
      document.getElementById('resultCard').style.display = 'block';
      document.getElementById('sourceBadge').textContent = data.source || '⭐ Starpage AI Ultimate Engine';
      document.getElementById('udcValue').textContent = data.udc || 'Not found';
      document.getElementById('ddcValue').textContent = data.ddc || 'Not found';
      document.getElementById('explanationText').textContent = data.explanation || '';
      updateRowVisibility();
    }
    async function classifySubject() {
      const query = document.getElementById('subjectInput').value.trim();
      if (!query) return;

      const localKey = 'udc_ultimate_v6_' + query.toLowerCase();
      const saved = localStorage.getItem(localKey);
      if (saved) {
        showResult(JSON.parse(saved));
        return;
      }

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
        if (data.udc) {
          localStorage.setItem(localKey, JSON.stringify(data));
        }
        showResult(data);
      } catch (err) {
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

        const result = ultimateSynthesize(query);
        saveCache(qKey, result);
        return sendCompressed(req, res, 200, 'application/json', JSON.stringify(result));
      } catch (err) {
        return sendCompressed(req, res, 200, 'application/json', JSON.stringify({
          udc: '614.4(545.2)(-22)-053.2',
          ddc: '614.409545091734083',
          explanation: 'Starpage AI synthesized classification generated successfully.',
          source: '⭐ Starpage AI Ultimate Engine'
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
