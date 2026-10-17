const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ਬਿਨਾਂ ਬਾਹਰੀ ਪੈਕੇਜ ਦੇ CORS ਅਤੇ JSON ਸਪੋਰਟ
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// ਰੂਟ ਅਤੇ public ਦੋਵੇਂ ਫ਼ੋਲਡਰਾਂ ਤੋਂ ਫ਼ਾਈਲਾਂ ਸਰਵ ਕਰਨਾ
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// ਰੈਫ਼ਰੈਂਸ ਡਾਟਾ ਸੁਰੱਖਿਅਤ ਤਰੀਕੇ ਨਾਲ ਲੋਡ ਕਰਨਾ (ਮੈਮਰੀ ਕ੍ਰੈਸ਼ ਤੋਂ ਬਚਾਅ)
let records = [];

function loadCompactData() {
  const files = [
    { name: 'udc-1961-reference-index.json', type: 'UDC' },
    { name: 'ddc-23-reference-index.json', type: 'DDC' }
  ];

  for (const f of files) {
    const fullPath = path.join(__dirname, f.name);
    if (!fs.existsSync(fullPath)) continue;

    try {
      const raw = fs.readFileSync(fullPath, 'utf8');
      const parsed = JSON.parse(raw);
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
    } catch (err) {
      console.error(`Skipping ${f.name} due to error:`, err.message);
    }
  }
}

// ਸਰਵਰ ਸ਼ੁਰੂ ਹੋਣ 'ਤੇ ਡਾਟਾ ਲੋਡ ਕਰਨਾ
loadCompactData();

// ਸਮਾਰਟ ਸਰਚ ਲੌਜਿਕ
function searchIndex(query) {
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

// API ਐਂਡਪੁਆਇੰਟਸ
app.post(['/api/classify', '/api/ask', '/classify'], (req, res) => {
  try {
    const input = req.body.message || req.body.query || req.body.text || req.body.input || '';

    if (!input.trim()) {
      return res.json({ reply: 'ਕਿਰਪਾ ਕਰਕੇ ਕੋਈ ਵਿਸ਼ਾ ਜਾਂ ਕੀਵਰਡ ਲਿਖੋ।', matches: [] });
    }

    const results = searchIndex(input);

    if (results.length === 0) {
      return res.json({
        reply: `"${input}" ਲਈ ਕੋਈ ਸਹੀ ਮੈਚ ਨਹੀਂ ਮਿਲਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਸ਼ਬਦ ਬਦਲ ਕੇ ਦੇਖੋ।`,
        matches: []
      });
    }

    let replyText = `"${input}" ਲਈ ਸਭ ਤੋਂ ਸਹੀ ਨਤੀਜੇ:\n\n`;
    results.forEach((item, index) => {
      replyText += `${index + 1}. [${item.type}] ਕੋਡ: ${item.code || 'N/A'} | ${item.text}\n`;
    });

    res.json({ reply: replyText, matches: results });
  } catch (err) {
    res.status(500).json({ error: 'ਪ੍ਰੋਸੈਸਿੰਗ ਵਿੱਚ ਗਲਤੀ ਆਈ।' });
  }
});

// index.html ਸਰਵ ਕਰਨਾ
app.get('*', (req, res) => {
  const rootIndex = path.join(__dirname, 'index.html');
  const publicIndex = path.join(__dirname, 'public', 'index.html');

  if (fs.existsSync(rootIndex)) {
    res.sendFile(rootIndex);
  } else if (fs.existsSync(publicIndex)) {
    res.sendFile(publicIndex);
  } else {
    res.status(404).send('index.html ਨਹੀਂ ਮਿਲੀ।');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
