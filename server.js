const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Aapki original index.html aur assets bina version change kiye root se load honge[span_7](start_span)[span_7](end_span)
app.use(express.static(__dirname));

// Reference index data safely load karna[span_8](start_span)[span_8](end_span)
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
  console.log(`Data Loaded: UDC (${udcData.length}), DDC (${ddcData.length})`);
} catch (err) {
  console.error("Index load error:", err.message);
}

// Smart Ranking & Intelligence Logic[span_9](start_span)[span_9](end_span)
function searchSmartClassification(query) {
  const cleanQuery = (query || '').toLowerCase().trim();
  if (!cleanQuery) return [];

  // Stop-words filtering (behtar matching ke liye)
  const stopWords = new Set(['the', 'is', 'in', 'and', 'to', 'of', 'for', 'with', 'on', 'at', 'a', 'an']);
  const tokens = cleanQuery.split(/[\s,.-]+/).filter(t => t.length > 1 && !stopWords.has(t));

  function calculateScore(item, systemType) {
    const title = (item.title || item.name || '').toLowerCase();
    const description = (item.description || item.notes || '').toLowerCase();
    const code = (item.code || item.class || item.number || '').toString().toLowerCase();

    let score = 0;

    // 1. Exact code match (Sabse zyada priority)
    if (code === cleanQuery) {
      score += 120;
    }

    // 2. Exact phrase match in title
    if (title.includes(cleanQuery)) {
      score += 60;
    }

    // 3. Exact phrase match in description
    if (description.includes(cleanQuery)) {
      score += 30;
    }

    // 4. Token-level matching (Spelling aur parts match karne ke liye)
    tokens.forEach(tok => {
      if (title.includes(tok)) score += 15;
      if (description.includes(tok)) score += 6;
      if (code.includes(tok)) score += 20;
    });

    return { ...item, systemType, score };
  }

  const udcMatches = udcData.map(item => calculateScore(item, 'UDC')); //[span_10](start_span)[span_10](end_span)
  const ddcMatches = ddcData.map(item => calculateScore(item, 'DDC')); //[span_11](start_span)[span_11](end_span)

  const combined = [...udcMatches, ...ddcMatches].filter(res => res.score > 0);

  // Highest score results sabse upar
  combined.sort((a, b) => b.score - a.score);

  return combined.slice(0, 5);
}

// API Routes (Purane frontend ke compatibility ke sath)
app.post(['/api/classify', '/api/ask', '/classify'], (req, res) => {
  try {
    const input = req.body.message || req.body.query || req.body.text || req.body.input || '';

    if (!input.trim()) {
      return res.json({ reply: "Kripya koi topic ya keyword likhein.", matches: [] });
    }

    const results = searchSmartClassification(input);

    if (results.length === 0) {
      return res.json({
        reply: `Query "${input}" ke liye koi satik match nahi mila. Kripya alag keywords use karein.`,
        matches: []
      });
    }

    // Clean human-readable response format[span_12](start_span)[span_12](end_span)
    let replyText = `Results for "${input}":\n\n`;
    results.forEach((item, index) => {
      const code = item.code || item.class || item.number || 'N/A';
      const heading = item.title || item.name || 'Untitled';
      replyText += `${index + 1}. [${item.systemType}] Code: ${code} | ${heading}\n`;
    });

    res.json({ reply: replyText, matches: results });
  } catch (err) {
    res.status(500).json({ error: "Processing error", details: err.message });
  }
});

// Original index.html ko bina kisi badlav ke serve karna[span_13](start_span)[span_13](end_span)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
