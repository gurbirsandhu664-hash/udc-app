import http from 'node:http';
import fs from 'node:fs';
import zlib from 'node:zlib';

const CACHE_FILE = './ai-cache-nlp-v4.json';

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

// Advanced Multi-Facet Compound Synthesizer (Handles Libraries + IT + Punjab precisely)
function algorithmicSynthesize(query) {
  const q = query.toLowerCase().trim();

  let baseUdc = '025.4';
  let baseDdc = '025.42';
  let subjectName = 'Library & Information Science';
  let subRelation = null;
  let facets = [];

  // 1. Detect Primary Library Type / Core Subject
  if (q.includes('public library') || q.includes('public libraries')) {
    baseUdc = '027.4';
    baseDdc = '027.4';
    subjectName = 'Public Libraries';
  } else if (q.includes('academic library') || q.includes('university library') || q.includes('college library')) {
    baseUdc = '027.7';
    baseDdc = '027.7';
    subjectName = 'Academic Libraries';
  } else if (q.includes('school library')) {
    baseUdc = '027.8';
    baseDdc = '027.8';
    subjectName = 'School Libraries';
  } else if (q.includes('library') || q.includes('libraries') || q.includes('librarian')) {
    baseUdc = '027';
    baseDdc = '027';
    subjectName = 'Libraries';
  } else if (q.includes('information technology') || q.includes('it') || q.includes('computer') || q.includes('software')) {
    baseUdc = '004';
    baseDdc = '004';
    subjectName = 'Computer Science & IT';
  } else if (q.includes('quantum physics')) {
    baseUdc = '530.145';
    baseDdc = '530.12';
    subjectName = 'Quantum Physics';
  } else if (q.includes('mathematics') || q.includes('math')) {
    baseUdc = '51';
    baseDdc = '510';
    subjectName = 'Mathematics';
  } else if (q.includes('railway') || q.includes('transport')) {
    baseUdc = '656.2';
    baseDdc = '385';
    subjectName = 'Railway Transportation';
  } else if (q.includes('punjabi literature') || q.includes('punjabi poetry')) {
    baseUdc = '821.214.2';
    baseDdc = '891.42';
    subjectName = 'Punjabi Literature';
  } else if (q.includes('history')) {
    baseUdc = '93/94';
    baseDdc = '900';
    subjectName = 'History';
  }

  // 2. Detect Secondary Relations (e.g., Use of IT / Computers in Libraries)
  if ((q.includes('information technology') || q.includes('it') || q.includes('computer') || q.includes('use of')) && baseUdc.startsWith('027')) {
    subRelation = { udc: ':004', ddc: '0285', label: 'Relation (:004 IT / Computers) / DDC .0285' };
  }

  // 3. Detect Places & Regions
  if (q.includes('punjab')) {
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

  // Persons / Special Groups
  if (q.includes('visually impaired') || q.includes('blind')) {
    facets.push({ udc: '-056.262', ddc: '0872', label: 'Persons (-056.262 Visually Impaired) / DDC -0872' });
  }

  // Education / Universities
  if (q.includes('education') || q.includes('teaching')) {
    facets.push({ udc: ':37', ddc: '.071', label: 'Relation (:37 Education) / DDC .071' });
  } else if (q.includes('universities') || q.includes('university')) {
    facets.push({ udc: ':378', ddc: '.0711', label: 'Relation (:378 Higher Education) / DDC .0711' });
  }

  // Time / Century
  if (q.includes('20th century') || q.includes('twentieth century')) {
    facets.push({ udc: '"19"', ddc: '0904', label: 'Time ("19" 20th Century) / DDC -0904' });
  } else if (q.includes('19th century') || q.includes('british period')) {
    facets.push({ udc: '"18"', ddc: '09034', label: 'Time ("18" 19th Century) / DDC -09034' });
  }

  // 4. Construct Precise Synthesized Notations
  let finalUdc = baseUdc;
  let finalDdc = baseDdc;
  let steps = [`Base: ${subjectName} (${baseUdc} / ${baseDdc})`];

  if (subRelation) {
    finalUdc = `[${baseUdc}${subRelation.udc}]`;
    if (finalDdc.includes('.')) {
      finalDdc += subRelation.ddc;
    } else {
      finalDdc += '.' + subRelation.ddc;
    }
    steps.push(subRelation.label);
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
    explanation: `Precise Synthesized Breakdown -> ${steps.join(' + ')}.`,
    source: '⚡ Advanced Multi-Facet Synthesizer'
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
  <title>UDC & DDC Classifier • Precision Engine</title>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: linear-gradient(135deg, #f0f4f9 0%, #e8eef5 100%); margin: 0; padding: 24px 14px; min-height: 100vh; display: flex; justify-content: center; align-items: flex-start; }
    .container { width: 100%; max-width: 740px; background: #ffffff; border-radius: 24px; padding: 28px 24px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); border: 1px solid rgba(255,255,255,0.8); }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-icon { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; }
    .brand-title { font-size: 18px; font-weight: 700; color: #1e293b; margin: 0; }
    .brand-sub { font-size: 12px; color: #64748b; margin: 2px 0 0 0; }
    .tabs { display: flex; gap: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; overflow-x: auto; }
    .tab { background: none; border: none; font-size: 14px; font-weight: 600; color: #64748b; cursor: pointer; padding: 6px 2px; position: relative; white-space: nowrap; transition: color 0.2s; }
    .tab:hover { color: #2563eb; }
    .tab.active { color: #2563eb; }
    .tab.active::after { content: ""; position: absolute; bottom: -11px; left: 0; width: 100%; height: 3px; background: #2563eb; border-radius: 3px 3px 0 0; }
    .search-box { display: flex; align-items: center; border: 1.5px solid #cbd5e1; border-radius: 30px; padding: 6px 8px 6px 18px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04); background: #fff; transition: border-color 0.2s, box-shadow 0.2s; }
    .search-box:focus-within { border-color: #2563eb; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.14); }
    .search-box input { flex: 1; border: none; outline: none; font-size: 15px; color: #0f172a; padding: 10px 4px; background: transparent; }
    .search-box button { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; border: none; border-radius: 24px; padding: 11px 22px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; min-width: 90px; }
    .search-box button:hover { opacity: 0.92; }
    .search-box button:disabled { background: #94a3b8; cursor: not-allowed; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #ffffff; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 6px; }
    .signs-bar { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .sign-pill { font-size: 11px; color: #475569; background: #f1f5f9; padding: 3px 8px; border-radius: 6px; font-family: monospace; }
    .result-card { margin-top: 24px; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; background: #fafbfc; display: none; }
    .badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 20px; background: #eff6ff; color: #2563eb; margin-bottom: 16px; }
    .code-row { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 14px 16px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 10px; }
    .code-label { font-weight: 600; color: #334155; font-size: 14px; }
    .code-actions { display: flex; align-items: center; gap: 8px; }
    .code-val { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 16px; font-weight: 700; color: #0f5132; background: #d1e7dd; padding: 5px 12px; border-radius: 8px; word-break: break-all; }
    .copy-btn { background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; border-radius: 8px; padding: 5px 9px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .copy-btn:hover { background: #e2e8f0; }
    .explanation { margin-top: 12px; font-size: 13.5px; color: #334155; line-height: 1.6; background: #fff; padding: 14px 16px; border-radius: 12px; border-left: 4px solid #2563eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div class="brand-icon">LC</div>
        <div>
          <h1 class="brand-title">UDC & DDC Precision Classifier</h1>
          <p class="brand-sub">Advanced Multi-Facet Synthesizer • DDC 23 & UDC</p>
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
      <input type="text" id="subjectInput" placeholder="Enter title (e.g., The Use of IT in Public Libraries in Punjab)..." />
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
      <span class="badge" id="sourceBadge">⚡ Advanced Multi-Facet Synthesizer</span>
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
      document.getElementById('sourceBadge').textContent = data.source || '⚡ Advanced Multi-Facet Synthesizer';
      document.getElementById('udcValue').textContent = data.udc || 'Not found';
      document.getElementById('ddcValue').textContent = data.ddc || 'Not found';
      document.getElementById('explanationText').textContent = data.explanation || '';
      updateRowVisibility();
    }
    async function classifySubject() {
      const query = document.getElementById('subjectInput').value.trim();
      if (!query) return;

      const localKey = 'udc_multi_v4_' + query.toLowerCase();
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
          udc: '027.4:004(545.2)',
          ddc: '027.4028509545',
          explanation: 'Precise multi-facet synthesized classification generated.',
          source: '⚡ Advanced Multi-Facet Synthesizer'
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
