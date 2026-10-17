const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ਰੂਟ ਅਤੇ public ਦੋਵੇਂ ਫ਼ੋਲਡਰਾਂ ਤੋਂ ਸਟੈਟਿਕ ਫ਼ਾਈਲਾਂ ਸਰਵ ਕਰਨਾ
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// ਰੈਫ਼ਰੈਂਸ ਡਾਟਾ ਮੈਮੋਰੀ ਵਿੱਚ ਲੋਡ ਕਰਨਾ
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
  console.log(`ਡਾਟਾ ਲੋਡ ਹੋ ਗਿਆ: UDC (${udcData.length}), DDC (${ddcData.length})`);
} catch (err) {
  console.error("Index file load karan vich error:", err.message);
}

// ਸਮਾਰਟ ਟੋਕਨਾਈਜ਼ੇਸ਼ਨ ਅਤੇ ਫ਼ਜ਼ੀ ਮੈਚਿੰਗ ਫੰਕਸ਼ਨ
function searchSmartClassification(query) {
  const cleanQuery = (query || '').toLowerCase().trim();
  if (!cleanQuery) return [];

  // ਸਟਾਪ-ਵਰਡਜ਼ ਹਟਾਉਣਾ ਤਾਂ ਜੋ ਸਿਰਫ਼ ਮੁੱਖ ਵਿਸ਼ੇ 'ਤੇ ਧਿਆਨ ਰਹੇ
  const stopWords = new Set(['the', 'is', 'in', 'and', 'to', 'of', 'for', 'with', 'on', 'at', 'a', 'an']);
  const tokens = cleanQuery.split(/[\s,.-]+/).filter(t => t.length > 1 && !stopWords.has(t));

  function calculateScore(item, systemType) {
    const title = (item.title || item.name || '').toLowerCase();
    const description = (item.description || item.notes || '').toLowerCase();
    const code = (item.code || item.class || item.number || '').toString().toLowerCase();

    let score = 0;

    // 1. ਐਗਜ਼ੈਕਟ ਕੋਡ ਮੈਚ (ਸਭ ਤੋਂ ਵੱਧ ਪ੍ਰਾਥਮਿਕਤਾ)
    if (code === cleanQuery) {
      score += 150;
    }

    // 2. ਟਾਈਟਲ ਵਿੱਚ ਪੂਰਾ ਵਾਕ ਮਿਲਣਾ
    if (title.includes(cleanQuery)) {
      score += 80;
    }

    // 3. ਵੇਰਵੇ (Description) ਵਿੱਚ ਪੂਰਾ ਵਾਕ ਮਿਲਣਾ
    if (description.includes(cleanQuery)) {
      score += 40;
    }

    // 4. ਟੋਕਨ ਪੱਧਰ 'ਤੇ ਮੈਚਿੰਗ (ਕੀਵਰਡ ਦੇ ਹਿੱਸੇ)
    tokens.forEach(tok => {
      if (code.startsWith(tok)) score += 30;
      if (title.includes(tok)) score += 20;
      if (description.includes(tok)) score += 8;
    });

    return { ...item, systemType, score };
  }

  const udcMatches = udcData.map(item => calculateScore(item, 'UDC'));
  const ddcMatches = ddcData.map(item => calculateScore(item, 'DDC'));

  // ਸਿਰਫ਼ ਉਹ ਰਿਕਾਰਡ ਰੱਖਣੇ ਜਿਨ੍ਹਾਂ ਦਾ ਸਕੋਰ 0 ਤੋਂ ਵੱਧ ਹੋਵੇ
  const combined = [...udcMatches, ...ddcMatches].filter(res => res.score > 0);

  // ਸਕੋਰ ਅਨੁਸਾਰ ਘਟਦੇ ਕ੍ਰਮ ਵਿੱਚ ਲਗਾਉਣਾ (ਸਭ ਤੋਂ ਸਹੀ ਜਵਾਬ ਸਭ ਤੋਂ ਉੱਪਰ)
  combined.sort((a, b) => b.score - a.score);

  return combined.slice(0, 5);
}

// API ਐਂਡਪੁਆਇੰਟਸ (ਸਾਰੇ ਆਮ ਰੂਟਾਂ ਦੀ ਸੁਵਿਧਾ)
app.post(['/api/classify', '/api/ask', '/classify'], (req, res) => {
  try {
    const input = req.body.message || req.body.query || req.body.text || req.body.input || '';

    if (!input.trim()) {
      return res.json({ reply: "ਕਿਰਪਾ ਕਰਕੇ ਕੋਈ ਵਿਸ਼ਾ ਜਾਂ ਕੀਵਰਡ ਲਿਖੋ।", matches: [] });
    }

    const results = searchSmartClassification(input);

    if (results.length === 0) {
      return res.json({
        reply: `ਕੁਐਰੀ "${input}" ਲਈ ਕੋਈ ਸਹੀ ਮੈਚ ਨਹੀਂ ਮਿਲਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਵੱਖਰੇ ਸ਼ਬਦ ਵਰਤ ਕੇ ਦੇਖੋ।`,
        matches: []
      });
    }

    // ਸਾਫ਼ ਅਤੇ ਸਪਸ਼ਟ ਫਾਰਮੈਟ
    let replyText = `"${input}" ਲਈ ਸਭ ਤੋਂ ਸਹੀ ਨਤੀਜੇ:\n\n`;
    results.forEach((item, index) => {
      const code = item.code || item.class || item.number || 'N/A';
      const heading = item.title || item.name || 'ਬਿਨਾਂ ਸਿਰਲੇਖ';
      replyText += `${index + 1}. [${item.systemType}] ਕੋਡ: ${code} | ${heading}\n`;
    });

    res.json({ reply: replyText, matches: results });
  } catch (err) {
    res.status(500).json({ error: "ਪ੍ਰੋਸੈਸਿੰਗ ਵਿੱਚ ਗਲਤੀ ਆਈ।", details: err.message });
  }
});

// index.html ਨੂੰ ਰੂਟ ਅਤੇ public ਦੋਵਾਂ ਥਾਵਾਂ 'ਤੇ ਆਪਣੇ-ਆਪ ਲੱਭਣਾ
app.get('*', (req, res) => {
  const rootIndex = path.join(__dirname, 'index.html');
  const publicIndex = path.join(__dirname, 'public', 'index.html');

  if (fs.existsSync(rootIndex)) {
    return res.sendFile(rootIndex);
  } else if (fs.existsSync(publicIndex)) {
    return res.sendFile(publicIndex);
  } else {
    res.status(404).send("ਗ਼ਲਤੀ: index.html ਫ਼ਾਈਲ ਨਹੀਂ ਮਿਲੀ।");
  }
});

app.listen(PORT, () => {
  console.log(`ਸਰਵਰ ਪੋਰਟ ${PORT} 'ਤੇ ਸਫ਼ਲਤਾਪੂਰਵਕ ਚੱਲ ਰਿਹਾ ਹੈ।`);
});
