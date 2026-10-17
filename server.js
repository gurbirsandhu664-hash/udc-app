const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 10000;
const XAI_API_KEY = process.env.XAI_API_KEY || ''; // Render Environment Variables ਵਿੱਚ ਆਪਣੀ xAI Grok Key ਪਾਓ

// xAI Grok ਨੂੰ ਕਾਲ ਕਰਨ ਵਾਲਾ ਫੰਕਸ਼ਨ
function askGrok(titleText) {
  return new Promise((resolve, reject) => {
    if (!XAI_API_KEY) {
      return reject(new Error("XAI_API_KEY missing. Render Dashboard vich Environment Variable set karo."));
    }

    const systemPrompt = `You are an expert library classification specialist in UDC (Universal Decimal Classification) and DDC (Dewey Decimal Classification).
Analyze the input book/document title and respond ONLY with a strictly valid JSON object (no markdown, no backticks, no extra text) with the following exact keys:
{
  "mainSubject": "string",
  "subSubject": "string",
  "udcNotation": "exact UDC notation with all symbols/brackets/colons",
  "udcBreakdown": "step by step explanation of each UDC element/symbol",
  "confidence": "e.g. 96% - High",
  "notationAudit": "verification of base number and auxiliaries",
  "explanation": "comprehensive classification reasoning",
  "sources": "UDC Consortium MRF / Reference Tables",
  "ddcNumber": "exact DDC notation",
  "ddcBreakdown": "DDC schedule and table breakdown",
  "ddcExplanation": "explanation of DDC class assignment"
}`;

    const payload = JSON.stringify({
      model: "grok-beta",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Classify this title: "${titleText}"` }
      ],
      temperature: 0.1
    });

    const options = {
      hostname: 'api.x.ai',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
            let rawContent = parsed.choices[0].message.content.trim();
            // ਮਾਰਕਡਾਊਨ ਬੈਕਟਿਕਸ ਸਾਫ਼ ਕਰਨਾ
            if (rawContent.startsWith('```json')) {
              rawContent = rawContent.replace(/^```json/, '').replace(/```$/, '').trim();
            } else if (rawContent.startsWith('```')) {
              rawContent = rawContent.replace(/^```/, '').replace(/```$/, '').trim();
            }
            resolve(JSON.parse(rawContent));
          } else {
            reject(new Error(data));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
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

// HTTP ਸਰਵਰ
const server = http.createServer(async (req, res) => {
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

  // ਸਾਰੀਆਂ ਸੰਭਾਵਿਤ API ਕਾਲਾਂ ਹੈਂਡਲ ਕਰਨਾ
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const parsedBody = JSON.parse(body || '{}');
        const queryText = parsedBody.title || parsedBody.query || parsedBody.message || parsedBody.text || '';

        if (!queryText) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Title is required" }));
          return;
        }

        const grokResult = await askGrok(queryText);

        // ਫਰੰਟਐਂਡ ਦੇ ਸਾਰੇ ਵੱਖ-ਵੱਖ ਵੇਰੀਏਬਲ ਨਾਵਾਂ ਲਈ ਪੂਰੀ ਮੈਪਿੰਗ
        const finalResponse = {
          success: true,
          title: queryText,
          // UDC ਖਾਨੇ
          mainSubject: grokResult.mainSubject || '',
          subSubject: grokResult.subSubject || '',
          udcNotation: grokResult.udcNotation || '',
          udcBreakdown: grokResult.udcBreakdown || '',
          confidence: grokResult.confidence || '95%',
          notationAudit: grokResult.notationAudit || '',
          explanation: grokResult.explanation || '',
          sources: grokResult.sources || 'UDC Consortium / International Edition',
          // DDC ਖਾਨੇ
          ddcNumber: grokResult.ddcNumber || '',
          ddcBreakdown: grokResult.ddcBreakdown || '',
          ddcExplanation: grokResult.ddcExplanation || '',
          // ਪੁਰਾਣੇ ਸਿਸਟਮਾਂ ਲਈ ਫਾਲਬੈਕ
          reply: `UDC: ${grokResult.udcNotation} | DDC: ${grokResult.ddcNumber}\nMain Subject: ${grokResult.mainSubject}`,
          data: grokResult
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(finalResponse));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // ਸਟੈਟਿਕ ਫ਼ਾਈਲਾਂ (Root ਅਤੇ Public ਦੋਵਾਂ ਤੋਂ)
  let safePath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.join(__dirname, safePath);

  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'public', safePath);
  }

  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'index.html');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(__dirname, 'public', 'index.html');
    }
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server with Real Grok Intelligence running on port ${PORT}`);
});
