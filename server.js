const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let udcData = [];
try {
  const rawData = fs.readFileSync(path.join(__dirname, 'seed-udc.json'), 'utf8');
  udcData = JSON.parse(rawData);
} catch (err) {
  console.error("Data load error:", err);
}

const baseScheduleRules = {
  "higher education": "378",
  "universities": "378",
  "colleges": "378",
  "academies": "378",
  "computers": "681.14",
  "computer": "681.14",
  "data processing": "681.14",
  "education": "37",
  "cybernetics": "007",
  "information theory": "007",
  "electronics": "621.38",
  "telecommunication": "621.39",
  "electrical engineering": "621.3"
};

app.post('/api/classify', (req, res) => {
  const rawTitle = req.body.title || "";
  const title = rawTitle.toLowerCase().trim();

  if (!title) {
    return res.status(400).json({ error: "Please enter a title." });
  }

  // 1. Direct Answer Key Match
  const directMatch = udcData.find(item => 
    item.keywords.some(k => title === k || title.includes(k))
  );

  if (directMatch) {
    return res.json({
      title: rawTitle,
      code: directMatch.code,
      description: directMatch.description,
      standard: "Uploaded UDC BS 1000A:1961 Edition"
    });
  }

  // 2. Compound Synthesis using Colon (:)
  let detectedCodes = [];
  for (const [key, code] of Object.entries(baseScheduleRules)) {
    if (title.includes(key) && !detectedCodes.includes(code)) {
      detectedCodes.push(code);
    }
  }

  if (detectedCodes.length >= 2) {
    return res.json({
      title: rawTitle,
      code: detectedCodes.join(':'),
      description: "Synthesized compound number using UDC relation sign (:)",
      standard: "Uploaded UDC BS 1000A:1961 Edition"
    });
  } else if (detectedCodes.length === 1) {
    return res.json({
      title: rawTitle,
      code: detectedCodes[0],
      description: "Base class match from 1961 schedule",
      standard: "Uploaded UDC BS 1000A:1961 Edition"
    });
  }

  return res.json({
    title: rawTitle,
    code: "001",
    description: "Science and knowledge in general",
    standard: "Fallback general classification"
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(Server running on port ${PORT});
});
