const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ਦੋਵੇਂ ਥਾਵਾਂ ਤੋਂ ਸਟੈਟਿਕ ਫ਼ਾਈਲਾਂ ਸਰਵ ਕਰਨਾ
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// ਰੈਫ਼ਰੈਂਸ ਡਾਟਾ ਲੋਡ ਕਰਨਾ
let udcData = [];
let ddcData = [];

try {
  const udcPath = path.join(__dirname, 'udc-1961-reference-index.json');
  const ddcPath = path.join(__dirname, 'ddc-23-reference-index.json');

  if (fs.existsSync(udcPath)) {
    udcData = JSON.parse(fs.readFileSync(udcPath, 'utf8'));
  }
  if (fs.existsSync(ddcPath)) {
    ddcData = JSON.parse(fs.readFileSync(ddcPath, 'utf8'));
  }
  console.log(`Loaded UDC: ${udcData.length}, DDC: ${ddcData.length}`);
} catch (err) {
  console.error("Index load error:", err.message);
}

// ਸਮਾਰਟ ਸਰਚ ਲੌਜਿਕ
function searchSmartClassification(query) {
  const cleanQuery = (query || '').toLowerCase().trim();
  if (!cleanQuery) return [];

  const tokens = cleanQuery.split(/[\s,.-]+/).filter(t => t.length > 1);

  function calculateScore(item, systemType) {
    const title = (item.title || item.name || '').toLowerCase();
    const description = (item.description || item.notes || '').toLowerCase();
    const code = (item.code || item.class || item.number || '').toString().toLowerCase();

    let score = 0;
    if (code === cleanQuery) score += 120;
    if (title.includes(cleanQuery)) score += 60;
    if (description.includes(cleanQuery)) score += 30;

    tokens.forEach(tok => {
      if (title.includes(tok)) score += 15;
      if (description.includes(tok)) score += 6;
      if (code.includes(tok)) score += 20;
    });

    return { ...item, systemType, score };
  }

  const udcMatches = udcData.map(item => calculateScore(item, 'UDC'));
  const ddcMatches = ddcData.map(item => calculateScore(item, 'DDC'));
  const combined = [...udcMatches, ...ddcMatches].filter(res => res.score > 0);

  combined.sort((a, b) => b.score - a.score);
  return combined.slice(0, 5);
}

// API ਐਂਡਪੁਆਇੰਟ
app.post(['/api/classify', '/api/ask', '/classify'], (req, res) => {
  try {
    const input = req.body.message || req.body.query || req.body.text || req.body.input || '';
    if (!input.trim()) {
      return res.json({ reply: "ਕਿਰਪਾ ਕਰਕੇ ਕੋਈ ਵਿਸ਼ਾ ਜਾਂ ਕੀਵਰਡ ਲਿਖੋ।", matches: [] });
    }

    const results = searchSmartClassification(input);
    if (results.length === 0) {
      return res.json({
        reply: `"${input}" ਲਈ ਕੋਈ ਸਹੀ ਮੈਚ ਨਹੀਂ ਮਿਲਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਕੋਈ ਹੋਰ ਸ਼ਬਦ ਲਿਖੋ।`,
        matches: []
      });
    }

    let replyText = `"${input}" ਲਈ ਨਤੀਜੇ:\n\n`;
    results.forEach((item, index) => {
      const code = item.code || item.class || item.number || 'N/A';
      const heading = item.title || item.name || 'Untitled';
      replyText += `${index + 1}. [${item.systemType}] ਕੋਡ: ${code} | ${heading}\n`;
    });

    res.json({ reply: replyText, matches: results });
  } catch (err) {
    res.status(500).json({ error: "ਪ੍ਰੋਸੈਸਿੰਗ ਵਿੱਚ ਗਲਤੀ ਆਈ।" });
  }
});

// index.html ਨੂੰ ਆਪਣੇ-ਆਪ ਦੋਵਾਂ ਥਾਵਾਂ 'ਤੇ ਲੱਭਣਾ
app.get('*', (req, res) => {
  const rootIndex = path.join(__dirname, 'index.html');
  const publicIndex = path.join(__dirname, 'public', 'index.html');

  if (fs.existsSync(rootIndex)) {
    return res.sendFile(rootIndex);
  } else if (fs.existsSync(publicIndex)) {
    return res.sendFile(publicIndex);
  } else {
    res.status(404).send("index.html ਫ਼ਾਈਲ ਨਹੀਂ ਮਿਲੀ।");
  }
});

app.listen(PORT, () => {
  console.log(`ਸਰਵਰ ਪੋਰਟ ${PORT} 'ਤੇ ਚੱਲ ਰਿਹਾ ਹੈ।`);
});
