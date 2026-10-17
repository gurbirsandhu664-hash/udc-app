const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 10000;

// ਰੈਫ਼ਰੈਂਸ ਡਾਟਾ ਸੁਰੱਖਿਅਤ ਲੋਡ ਕਰਨਾ
let records = [];

function loadData() {
  const files = [
    { name: 'udc-1961-reference-index.json', type: 'UDC' },
    { name: 'ddc-23-reference-index.json', type: 'DDC' }
  ];

  for (const f of files) {
    const fullPath = path.join(__dirname, f.name);
    if (!fs.existsSync(fullPath)) continue;

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const parsed = JSON.parse(content);
      const list = Array.isArray(parsed) ? parsed : Object.values(parsed);

      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item) continue;

        const code = String(item.code || item.class || item.number || item.id || '').trim();
        const text = String(item.title || item.name || item.description || item.heading || '').trim();

        if (code || text) {
          records.push({
            type: f.type,
            code: code,
            text: text,
            searchKey: (code + ' ' + text).toLowerCase()
          });
        }
      }
      console.log(`Loaded: ${f.name}`);
    } catch (e) {
      console.error(`Error loading ${f.name}:`, e.message);
    }
  }
}

loadData();

// ਸਮਾਰਟ ਸਰਚ ਲੌਜਿਕ
function searchSmart(query) {
  const clean = (query || '').toLowerCase().trim();
  if (!clean) return [];

  const tokens = clean.split(/[\s,.-]+/).filter(t => t.length > 1);
  const matches = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    let score = 0;

    if (r.code.toLowerCase() === clean) {
      score += 150;
    } else if (r.code.toLowerCase().startsWith(clean)) {
      score += 70;
    }

    if (r.text.toLowerCase().includes(clean)) {
      score += 50;
    }

    for (let j = 0; j < tokens.length; j++) {
      if (r.searchKey.includes(tokens[j])) {
        score += 15;
      }
    }

    if (score > 0) {
      matches.push({ type: r.type, code: r.code, text: r.text, score: score });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 5);
}

// MIME Types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// Pure Node.js ਸਰਵਰ
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // API Requests
  if (req.method === 'POST' && (pathname === '/api/classify' || pathname === '/api/ask' || pathname === '/classify')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const input = data.message || data.query || data.text || data.input || '';

        if (!input.trim()) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ reply: 'ਕਿਰਪਾ ਕਰਕੇ ਕੋਈ ਵਿਸ਼ਾ ਜਾਂ ਕੀਵਰਡ ਲਿਖੋ।', matches: [] }));
          return;
        }

        const results = searchSmart(input);

        if (results.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            reply: `"${input}" ਲਈ ਕੋਈ ਸਹੀ ਮੈਚ ਨਹੀਂ ਮਿਲਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਸ਼ਬਦ ਬਦਲ ਕੇ ਦੇਖੋ।`,
            matches: []
          }));
          return;
        }

        let replyText = `"${input}" ਲਈ ਸਭ ਤੋਂ ਸਹੀ ਨਤੀਜੇ:\n\n`;
        results.forEach((item, index) => {
          replyText += `${index + 1}. [${item.type}] ਕੋਡ: ${item.code || 'N/A'} | ${item.text}\n`;
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: replyText, matches: results }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'ਪ੍ਰੋਸੈਸਿੰਗ ਵਿੱਚ ਗਲਤੀ ਆਈ।' }));
      }
    });
    return;
  }

  // Static File Serving (Root ਅਤੇ Public ਦੋਵਾਂ ਤੋਂ)
  let safePath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.join(__dirname, safePath);

  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'public', safePath);
  }

  // ਜੇ ਫ਼ਾਈਲ ਨਹੀਂ ਮਿਲਦੀ ਤਾਂ index.html ਵੱਲ ਰੀਡਾਇਰੈਕਟ
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'index.html');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(__dirname, 'public', 'index.html');
    }
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
