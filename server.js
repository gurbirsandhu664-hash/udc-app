const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
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
  console.log(`UDC Items: ${udcData.length}, DDC Items: ${ddcData.length}`);
} catch (err) {
  console.error("Index load karan vich galti:", err.message);
}

// ਸਮਝਦਾਰ ਮੈਚਿੰਗ ਫੰਕਸ਼ਨ (Human-like Ranking Logic)
function searchClassifications(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return [];

  const words = q.split(/\s+/).filter(w => w.length > 2);

  function rankList(dataset, type) {
    return dataset.map(item => {
      const text = `${item.title || ''} ${item.description || ''} ${item.keywords || ''} ${item.name || ''}`.toLowerCase();
      const code = (item.code || item.class || item.number || '').toString().toLowerCase();

      let score = 0;
      // ਪੂਰਾ ਕੋਡ ਮੈਚ ਹੋਣ 'ਤੇ ਸਭ ਤੋਂ ਵੱਧ ਸਕੋਰ
      if (code === q) score += 100;
      // ਪੂਰਾ ਵਾਕ ਜਾਂ ਸ਼ਬਦ ਮਿਲਣ 'ਤੇ
      if (text.includes(q)) score += 50;

      // ਵੱਖ-ਵੱਖ ਸ਼ਬਦ ਮਿਲਣ 'ਤੇ
      words.forEach(w => {
        if (text.includes(w)) score += 15;
      });

      return { ...item, type, score };
    }).filter(x => x.score > 0);
  }

  const results = [...rankList(udcData, 'UDC'), ...rankList(ddcData, 'DDC')];
  // ਸਭ ਤੋਂ ਵਧੀਆ ਮੈਚ ਨੂੰ ਉੱਪਰ ਰੱਖਣਾ
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 5);
}

// API ਐਂਡਪੁਆਇੰਟ
app.post('/api/classify', (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "ਕਿਰਪਾ ਕਰਕੇ ਕੋਈ ਸਵਾਲ ਜਾਂ ਵਿਸ਼ਾ ਲਿਖੋ।" });
    }

    const matches = searchClassifications(message);

    if (matches.length === 0) {
      return res.json({
        reply: `ਤੁਹਾਡੀ ਖੋਜ "${message}" ਲਈ ਕੋਈ ਸਹੀ ਮੈਚ ਨਹੀਂ ਮਿਲਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਕੋਈ ਹੋਰ ਸ਼ਬਦ ਵਰਤ ਕੇ ਦੇਖੋ।`
      });
    }

    let reply = `"${message}" ਲਈ ਸਭ ਤੋਂ ਢੁਕਵੇਂ ਨਤੀਜੇ:\n\n`;
    matches.forEach((m, idx) => {
      const code = m.code || m.class || m.number || 'N/A';
      const label = m.title || m.name || m.description || 'ਕੋਈ ਵੇਰਵਾ ਨਹੀਂ';
      reply += `${idx + 1}. [${m.type}] ਕੋਡ: ${code} — ${label}\n`;
    });

    res.json({ reply, matches });
  } catch (error) {
    res.status(500).json({ error: "ਪ੍ਰੋਸੈਸ ਕਰਨ ਦੌਰਾਨ ਕੋਈ ਸਮੱਸਿਆ ਆਈ।" });
  }
});

// ਫਰੰਟਐਂਡ ਰੂਟ
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send("ਸਰਵਰ ਚੱਲ ਰਿਹਾ ਹੈ। public/index.html ਫ਼ਾਈਲ ਸ਼ਾਮਲ ਕਰੋ।");
  }
});

app.listen(PORT, () => {
  console.log(`ਸਰਵਰ ਪੋਰਟ ${PORT} 'ਤੇ ਸਫ਼ਲਤਾਪੂਰਵਕ ਚੱਲ ਰਿਹਾ ਹੈ।`);
});
