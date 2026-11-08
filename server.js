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
  return /^[0-9]+[0-9/:\(\)\.\+=\-A-Z'\s]*$/.test(s) && /\d/.test(s);
}

function buildDDC(baseDdc, formT1) {
  let res = String(baseDdc || '020').trim();
  if (formT1 && res.length >= 3) {
    if (res.includes('.')) res = `${res}0${formT1}`;
    else res = `${res}.${formT1}`;
  }
  if (res.length >= 4 && !res.includes('.')) {
    res = `${res.slice(0, 3)}.${res.slice(3)}`;
  }
  return res;
}

function masterClassify(title) {
  const t = norm(title);
  const EXACT = {
    'german pronouns': { udc: "811.112.2'36", ddc: '435', breakdown: "German grammar and pronouns.", desc: 'German Pronouns & Grammar.' },
    'italian phonetics': { udc: "811.131.1'344", ddc: '451.52', breakdown: "Italian phonetics.", desc: 'Italian Phonetics & Phonology.' },
    'french pronunciation': { udc: "811.133.1'344", ddc: '441.52', breakdown: "French pronunciation.", desc: 'French Pronunciation.' },
    'english hindi dictionary': { udc: '811.111(038)=214.21', ddc: '423.9143', breakdown: 'English-Hindi Dictionary.', desc: 'English-Hindi Dictionary.' },
    'bibliography of mathematics': { udc: '016:51', ddc: '016.51', breakdown: 'Bibliography of Mathematics.', desc: 'Bibliography of Mathematics.' },
    'medical education in india': { udc: '61:37(540)', ddc: '610.71154', breakdown: 'Medical Education in India.', desc: 'Medical Education in India.' },
    'history of japan': { udc: '94(520)', ddc: '952', breakdown: 'History of Japan.', desc: 'History of Japan.' },
    'agriculture in canada': { udc: '63(71)', ddc: '630.971', breakdown: 'Agriculture in Canada.', desc: 'Agriculture in Canada.' },
    'public health in india': { udc: '614(540)', ddc: '614.0954', breakdown: 'Public Health in India.', desc: 'Public Health in India.' },
    'dictionary of physics': { udc: '53(038)', ddc: '530.03', breakdown: 'Physics Dictionary.', desc: 'Physics Dictionary.' },
    'fevicol': { udc: '668.3', ddc: '668.3', breakdown: 'Adhesives and glues.', desc: 'Fevicol Adhesive.' }
  };
  if (EXACT[t]) return { ...EXACT[t], source: 'Standard Verified Schedule' };
  return null;
}

async function queryHighModelAI(title, clientApiKey) {
  const activeKey = clientApiKey || process.env.GEMINI_API_KEY || '';
  const prompt = `Classify "${title}" into UDC and DDC-23. Output ONLY JSON: {"udc":"...","ddc":"...","breakdown":"...","explanation":"..."}`;

  if (activeKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const json = await res.json();
        const txt = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (txt) {
          const parsed = JSON.parse(txt);
          if (isValidNotation(parsed.udc) && isValidNotation(parsed.ddc)) {
            return { ...parsed, source: 'Google Gemini High Model' };
          }
        }
      }
    } catch (_) {}
  }
  return null;
}

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>UDC & DDC Professional Classification Tool</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f1f5f9; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px 16px 60px; }
    .wrap { max-width: 760px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    h1 { font-size: clamp(24px, 5vw, 36px); font-weight: 800; color: #1e293b; margin: 0 0 8px; }
    .v { color: #2563eb; }
    .lead { color: #64748b; font-size: 15px; margin: 0; }
    .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 24px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
    label { display: block; font-size: 12px; font-weight: 800; color: #475569; margin-bottom: 8px; text-transform: uppercase; }
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
    .title-banner .subhead { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; }
    .title-banner h2 { margin: 6px 0 0; font-size: 22px; color: #0f172a; }
    .grid-results { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
    .result-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; }
    .result-box.highlight { background: #eff6ff; border-color: #bfdbfe; }
    .result-box .tag { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #2563eb; margin-bottom: 6px; }
    .result-box .number { font-size: clamp(24px, 4vw, 36px); font-weight: 900; color: #0f172a; margin: 4px 0 8px; }
    .result-box .detail { font-size: 13px; color: #475569; line-height: 1.45; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px; font-size: 13px; color: #334155; line-height: 1.5; }
    .source-tag { display: inline-block; margin-top: 8px; padding: 4px 10px; border-radius: 999px; background: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 700; }
    .api-settings { margin-top: 16px; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; }
    .api-settings label { font-size: 11px; color: #334155; margin-bottom: 4px; }
    .input-group { display: flex; gap: 8px; align-items: center; margin-top: 6px; }
    .api-settings input[type="password"] { flex: 1; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; background: #ffffff; }
    .btn-lock { padding: 10px 18px; border: 0; border-radius: 10px; background: #10b981; font-weight: 700; font-size: 13px; cursor: pointer; color: #ffffff; }
    .status-msg { margin-top: 6px; font-size: 12px; font-weight: 700; color: #10b981; display: none; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>Library Classification <span class="v">Professional</span></h1>
      <div class="lead">Gemini High Model & UDC/DDC Expert Tool</div>
    </div>
    <div class="card">
      <label for="title">Book Title / Subject Query</label>
      <textarea id="title" placeholder="ਕਿਤਾਬ ਦਾ ਟਾਈਟਲ ਲਿਖੋ...">German Pronouns</textarea>
      <div class="action-row">
        <button id="go" class="btn-classify">⚡ CLASSIFY</button>
        <button id="voice" type="button" class="btn-voice">🎙️ Voice</button>
      </div>
      <div id="voiceStatus" class="voice-status">Tap Voice to speak title or type directly.</div>
      <div class="api-settings">
        <label for="geminiKey">Gemini API Key (Permanent Secure Lock)</label>
        <div class="input-group">
          <input type="password" id="geminiKey" placeholder="Paste your Gemini API key here...">
          <button type="button" id="btnLock" class="btn-lock">🔒 Lock</button>
        </div>
        <div id="lockStatus" class="status-msg">✓ Key locked & secured!</div>
      </div>
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
        <div><b>Explanation:</b> <span id="resExplain"></span></div>
        <div id="resSource" class="source-tag"></div>
      </div>
    </div>
  </div>
  <script>
    const $ = id => document.getElementById(id);
    if (localStorage.getItem('perm_gemini_key')) {
      $('geminiKey').value = '••••••••••••••••••••••••••••••';
      $('geminiKey').disabled = true;
      $('btnLock').textContent = '🔒 Locked';
      $('lockStatus').style.display = 'block';
    }
    $('btnLock').addEventListener('click', () => {
      const k = $('geminiKey');
      if (k.disabled) return;
      const val = k.value.trim();
      if (!val || val.includes('•')) return;
      localStorage.setItem('perm_gemini_key', val);
      k.value = '••••••••••••••••••••••••••••••';
      k.disabled = true;
      $('btnLock').textContent = '🔒 Locked';
      $('lockStatus').style.display = 'block';
    });
    $('go').addEventListener('click', async () => {
      const title = $('title').value.trim();
      if (!title) return;
      const keyVal = localStorage.getItem('perm_gemini_key') || '';
      $('go').disabled = true; $('go').textContent = '⚡ SEARCHING...';
      try {
        const response = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, clientApiKey: keyVal })
        });
        const data = await response.json();
        $('resTitle').textContent = data.title || title;
        $('resUdc').textContent = data.udc_answer || '020';
        $('resUdcBreakdown').textContent = data.breakdown || '';
        $('resDdc').textContent = data.ddc_answer || '020';
        $('resDdcBreakdown').textContent = data.breakdown || '';
        $('resExplain').textContent = data.explanation || '';
        $('resSource').textContent = 'Engine: ' + (data.source || 'Engine');
        $('result').style.display = 'block';
      } catch (err) {
        alert('Error');
      } finally {
        $('go').disabled = false; $('go').textContent = '⚡ CLASSIFY';
      }
    });
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
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
    req.on('data', chunk => bodyStr += chunk);
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyStr || '{}');
        const title = String(body.title || '').trim();
        const clientApiKey = String(body.clientApiKey || '').trim();
        
        const aiRes = await queryHighModelAI(title, clientApiKey);
        const raw = masterClassify(title);

        const finalRes = aiRes || raw || { udc: '020', ddc: '020', breakdown: 'General works', explanation: 'General classification', source: 'Standard Schedule' };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'classified',
          title,
          udc_answer: finalRes.udc,
          ddc_answer: finalRes.ddc,
          breakdown: finalRes.breakdown,
          explanation: finalRes.explanation,
          source: finalRes.source
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error' }));
      }
    });
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => console.log(`Server on port ${PORT}`));
