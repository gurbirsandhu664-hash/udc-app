const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;
const ROOT = __dirname;
const INDEX = path.join(ROOT, 'index.html');

function send(res, code, type, body) {
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => {
      data += c;
      if (data.length > 1024 * 1024) reject(new Error('Request too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      if (!fs.existsSync(INDEX)) return send(res, 404, 'text/plain; charset=utf-8', 'index.html not found');
      return send(res, 200, 'text/html; charset=utf-8', fs.readFileSync(INDEX));
    }

    if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/api/health')) {
      return send(res, 200, 'application/json; charset=utf-8', JSON.stringify({
        ok: true,
        service: 'UDC Ultimate Classifier',
        version: 'FINAL-CORRECTED',
        mode: 'UDC-only'
      }));
    }

    // The classifier is deliberately kept in the same index.html so the answer key
    // and UI cannot drift apart. This endpoint is provided for compatibility.
    if (req.method === 'POST' && (url.pathname === '/api/classify' || url.pathname === '/classify')) {
      const body = await readBody(req);
      let payload = {};
      try { payload = JSON.parse(body || '{}'); } catch (_) {}
      const title = String(payload.title || payload.bookTitle || payload.query || '').trim();
      return send(res, 200, 'application/json; charset=utf-8', JSON.stringify({
        ok: true,
        title,
        message: 'Classification engine is embedded in index.html; submit the title through the web UI.'
      }));
    }

    return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
  } catch (err) {
    console.error(err);
    return send(res, 500, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: 'Server error' }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`UDC Ultimate FINAL-CORRECTED listening on ${PORT}`);
});
