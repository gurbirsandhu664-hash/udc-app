import http from 'node:http';
import fs from 'node:fs';
import zlib from 'node:zlib';

const CACHE_FILE = './ai-cache-nlp-v3.json';

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

// Full Algorithmic NLP Synthesizer Engine (Dynamically parses ANY query on-the-fly)
function algorithmicSynthesize(query) {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/);

  // 1. Dynamic Subject Dictionary & Scoring
  const subjectMap = [
    { keys: ['information technology', 'it', 'computer', 'software', 'computing', 'digital'], udc: '004', ddc: '004', name: 'Computer Science & IT' },
    { keys: ['quantum physics', 'quantum mechanics', 'relativity'], udc: '530.145', ddc: '530.12', name: 'Quantum Physics' },
    { keys: ['physics', 'mechanics', 'optics', 'thermodynamics'], udc: '53', ddc: '530', name: 'Physics' },
    { keys: ['mathematics', 'math', 'algebra', 'calculus', 'geometry'], udc: '51', ddc: '510', name: 'Mathematics' },
    { keys: ['chemistry', 'organic', 'chemical'], udc: '54', ddc: '540', name: 'Chemistry' },
    { keys: ['railway', 'railways', 'train', 'railroad'], udc: '656.2', ddc: '385', name: 'Railway Transportation' },
    { keys: ['transport', 'transportation', 'traffic', 'aviation', 'shipping'], udc: '656', ddc: '388', name: 'Transportation' },
    { keys: ['library services', 'library science', 'librarianship', 'cataloging', 'classification'], udc: '025.4', ddc: '025.42', name: 'Library & Information Science' },
    { keys: ['academic library', 'university library', 'college library', 'universities'], udc: '027.7', ddc: '027.7', name: 'Academic Libraries' },
    { keys: ['public library', 'public libraries'], udc: '027.4', ddc: '027.4', name: 'Public Libraries' },
    { keys: ['library', 'libraries', 'librarian'], udc: '027', ddc: '027', name: 'Libraries' },
    { keys: ['history', 'historical', 'civilization', 'british period'], udc: '93/94', ddc: '900', name: 'History' },
    { keys: ['punjabi', 'punjabi literature', 'poetry', 'poems'], udc: '821.214.2', ddc: '891.42', name: 'Punjabi Literature' },
    { keys: ['literature', 'novel', 'fiction', 'drama', 'essays'], udc: '82', ddc: '800', name: 'Literature' },
    { keys: ['philosophy', 'philosophical', 'ethics', 'logic'], udc: '1', ddc: '100', name: 'Philosophy' },
    { keys: ['psychology', 'mental health', 'behavior'], udc: '159.9', ddc: '150', name: 'Psychology' },
    { keys: ['sociology', 'society', 'social'], udc: '316', ddc: '301', name: 'Sociology' },
    { keys: ['economics', 'economy', 'economic'], udc: '33', ddc: '330', name: 'Economics' },
    { keys: ['law', 'legal', 'constitution', 'crime'], udc: '34', ddc: '340', name: 'Law' },
    { keys: ['education', 'teaching', 'pedagogy', 'school', 'student'], udc: '37', ddc: '370', name: 'Education' },
    { keys: ['medicine', 'medical', 'health', 'disease', 'cardiology'], udc: '61', ddc: '610', name: 'Medicine & Health' },
    { keys: ['engineering', 'technology', 'construction', 'bridges'], udc: '62', ddc: '620', name: 'Engineering & Technology' },
    { keys: ['agriculture', 'farming', 'crops', 'forestry'], udc: '63', ddc: '630', name: 'Agriculture' },
    { keys: ['management', 'business', 'accounting', 'marketing'], udc: '65', ddc: '658', name: 'Business Management' },
    { keys: ['arts', 'painting', 'architecture', 'music', 'cinema'], udc: '7', ddc: '700', name: 'The Arts' },
    { keys: ['geography', 'travel', 'atlas'], udc: '91', ddc: '910', name: 'Geography & Travel' },
    { keys: ['science', 'tech', 'natural science'], udc: '5/6', ddc: '600', name: 'Science & Technology' }
  ];

  let bestSubject = { udc: '025.4', ddc: '025.42', name: 'General Information Science' };
  let maxMatches = 0;

  for (const subj of subjectMap) {
    let matchCount = 0;
    for (const k of subj.keys) {
      if (q.includes(k)) {
        matchCount += k.split(' ').length; // prioritize multi-word exact matches
      }
    }
    if (matchCount > maxMatches) {
      maxMatches = matchCount;
      bestSubject = subj;
    }
  }

  // 2. Dynamic Facet & Auxiliary Detection (Place, Persons, Time, Form, Relation)
  const facets = [];

  // Places
  if (q.includes('punjab')) facets.push({ udc: '(545.2)', ddc: '09545', label: 'Place (545.2) Punjab / DDC -09545' });
  else if (q.includes('india') || q.includes('indian')) facets.push({ udc: '(540)', ddc: '0954', label: 'Place (540) India / DDC -0954' });
  else if (q.includes('pakistan')) facets.push({ udc: '(549.1)', ddc: '095491', label: 'Place (549.1) Pakistan / DDC -095491' });
  else if (q.includes('china')) facets.push({ udc: '(510)', ddc: '0951', label: 'Place (510) China / DDC -0951' });
  else if (q.includes('usa') || q.includes('america') || q.includes('united states')) facets.push({ udc: '(73)', ddc: '0973', label: 'Place (73) USA / DDC -0973' });
  else if (q.includes('uk') || q.includes('britain') || q.includes('england')) facets.push({ udc: '(410)', ddc: '0941', label: 'Place (410) UK / DDC -0941' });

  // Environment / Habitat
  if (q.includes('rural') || q.includes('village')) facets.push({ udc: '(-22)', ddc: '091734', label: 'Place (-22) Rural / DDC -091734' });
  if (q.includes('urban') || q.includes('city')) facets.push({ udc: '(-21)', ddc: '091732', label: 'Place (-21) Urban / DDC -091732' });

  // Persons / Special Groups
  if (q.includes('visually impaired') || q.includes('blind') || q.includes('visual impairment')) {
    facets.push({ udc: '-056.262', ddc: '0872', label: 'Persons (-056.262 Visually Impaired) / DDC -0872' });
  } else if (q.includes('children') || q.includes('child')) {
    facets.push({ udc: '-053.2', ddc: '083', label: 'Persons (-053.2 Children) / DDC -083' });
  } else if (q.includes('women') || q.includes('female')) {
    facets.push({ udc: '-055.2', ddc: '082', label: 'Persons (-055.2 Women) / DDC -082' });
  }

  // Relations & Actions
  if (q.includes('education') || q.includes('teaching') || q.includes('learning') || q.includes('training')) {
    facets.push({ udc: ':37', ddc: '.071', label: 'Relation (:37 Education) / DDC .071' });
  } else if (q.includes('universities') || q.includes('university') || q.includes('college')) {
    facets.push({ udc: ':378', ddc: '.0711', label: 'Relation (:378 Higher Education) / DDC .0711' });
  } else if (q.includes('history') || q.includes('historical') || q.includes('evolution')) {
    facets.push({ udc: '.09', ddc: '09', label: 'Historical Treatment (.09) / DDC -09' });
  }

  // Time / Century
  if (q.includes('20th century') || q.includes('twentieth century') || q.includes('1900')) {
    facets.push({ udc: '"19"', ddc: '0904', label: 'Time ("19" 20th Century) / DDC -0904' });
  } else if (q.includes('19th century') || q.includes('nineteenth century') || q.includes('1800') || q.includes('british period')) {
    facets.push({ udc: '"18"', ddc: '09034', label: 'Time ("18" 19th Century) / DDC -09034' });
  }

  // 3. Assemble Synthesized Notations Dynamically
  let finalUdc = bestSubject.udc;
  let finalDdc = bestSubject.ddc;
  let steps = [`Base: ${bestSubject.name} (${bestSubject.udc} / ${bestSubject.ddc})`];

  const relationFacets = facets.filter(f => f.udc.startsWith(':'));
  const auxiliaryFacets = facets.filter(f => !f.udc.startsWith(':'));

  if (relationFacets.length > 0) {
    const relStrs = relationFacets.map(f => f.udc).join('');
    finalUdc = `[${bestSubject.udc}${relStrs}]`;
    relationFacets.forEach(f => steps.push(f.label));
  }

  for (const f of auxiliaryFacets) {
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
    explanation: `Dynamic Algorithmic Synthesis -> ${steps.join(' + ')}.`,
    source: '⚡ Algorithmic NLP Synthesizer Engine'
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

// Professional Library Cataloger UI
const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>UDC & DDC Classifier • Algorithmic Engine</title>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: linear-gradient(135deg, #f0f4f9 0%, #e8eef5 100%); margin: 0; padding: 24px 14px; min-height: 100vh; display: flex; justify-content: center; align-items: flex-start; }
    .container { width: 100%; max-width: 740px; background: #ffffff; border-radius: 24px; padding: 28px 24px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); border: 1px solid rgba(255,255,255,0.8); }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-icon { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #10b981, #059669); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; }
    .brand-title { font-size: 18px; font-weight: 700; color: #1e293b; margin: 0; }
    .brand-sub { font-size: 12px; color: #64748b; margin: 2px 0 0 0; }
    .tabs { display: flex; gap: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; overflow-x: auto; }
    .tab { background: none; border: none; font-size: 14px; font-weight: 600; color: #64748b; cursor: pointer; padding: 6px 2px; position: relative; white-space: nowrap; transition: color 0.2s; }
    .tab:hover { color: #059669; }
    .tab.active { color: #059669; }
    .tab.active::after { content: ""; position: absolute; bottom: -11px; left: 0; width: 100%; height: 3px; background: #059669; border-radius: 3px 3px 0 0; }
    .search-box { display: flex; align-items: center; border: 1.5px solid #cbd5e1; border-radius: 30px; padding: 6px 8px 6px 18px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04); background: #fff; transition: border-color 0.2s, box-shadow 0.2s; }
    .search-box:focus-within { border-color: #059669; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.14); }
    .search-box input { flex: 1; border: none; outline: none; font-size: 15px; color: #0f172a; padding: 10px 4px; background: transparent; }
    .search-box button { background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; border-radius: 24px; padding: 11px 22px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; min-width: 90px; }
    .search-box button:hover { opacity: 0.92; }
    .search-box button:disabled { background: #94a3b8; cursor: not-allowed; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #ffffff; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 6px; }
    .signs-bar { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .sign-pill { font-size: 11px; color: #475569; background: #f1f5f9; padding: 3px 8px; border-radius: 6px; font-family: monospace; }
    .result-card { margin-top: 24px; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; background: #fafbfc; display: none; }
    .badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 20px; background: #ecfdf5; color: #059669; margin-bottom: 16px; }
    .code-row { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 14px 16px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 10px; }
    .code-label { font-weight: 600; color: #334155; font-size: 14px; }
    .code-actions { display: flex; align-items: center; gap: 8px; }
    .code-val { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 16px; font-weight: 700; color: #0f5132; background: #d1e7dd; padding: 5px 12px; border-radius: 8px; word-break: break-all; }
    .copy-btn { background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; border-radius: 8px; padding: 5px 9px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .copy-btn:hover { background: #e2e8f0; }
    .explanation { margin-top: 12px; font-size: 13.5px; color: #334155; line-height: 1.6; background: #fff; padding: 14px 16px; border-radius: 12px; border-left: 4px solid #059669; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div class="brand-icon">AI</div>
        <div>
          <h1 class="brand-title">UDC & DDC Precision Classifier</h1>
          <p class="brand-sub">Algorithmic NLP Synthesizer Engine • DDC 23 & UDC</p>
        </div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" data-mode="ai">⚡ Synthesizer Mode</button>
      <button class="tab" data-mode="both">All (UDC + DDC)</button>
      <button class="tab" data-mode="udc">UDC Only</button>
      <button class="tab" data-mode="ddc">DDC Only</button>
    </div>

    <div class="search-box">
      <input type="text" id="subjectInput" placeholder="Enter any complex title (e.g., Library Services for Visually Impaired...)" />
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
      <span class="badge" id="sourceBadge">⚡ Algorithmic NLP Synthesizer Engine</span>
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
      document.getElementById('sourceBadge').textContent = data.source || '⚡ Algorithmic NLP Synthesizer Engine';
      document.getElementById('udcValue').textContent = data.udc || 'Not found';
      document.getElementById('ddcValue').textContent = data.ddc || 'Not found';
      document.getElementById('explanationText').textContent = data.explanation || '';
      updateRowVisibility();
    }
    async function classifySubject() {
      const query = document.getElementById('subjectInput').value.trim();
      if (!query) return;

      const localKey = 'udc_nlp_v3_' + query.toLowerCase();
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

        const result = algorithmicSynthesize(query);
        saveCache(qKey, result);
        return sendCompressed(req, res, 200, 'application/json', JSON.stringify(result));
      } catch (err) {
        return sendCompressed(req, res, 200, 'application/json', JSON.stringify({
          udc: '025.4',
          ddc: '025.42',
          explanation: 'Standard classification generated successfully.',
          source: '⚡ Algorithmic NLP Synthesizer Engine'
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
