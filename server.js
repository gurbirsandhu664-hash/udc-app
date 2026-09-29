const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Seed data load
let udcData = [];
try {
  const seedPath = path.join(__dirname, 'seed-udc.json');
  if (fs.existsSync(seedPath)) {
    udcData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  }
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

// UI Route (Fallback HTML ਤਾਂ ਕਿ ਪੇਜ ਕਦੇ ਫੇਲ ਨਾ ਹੋਵੇ)
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  const publicIndexPath = path.join(__dirname, 'public', 'index.html');
  
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  } else if (fs.existsSync(publicIndexPath)) {
    return res.sendFile(publicIndexPath);
  } else {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>UDC V45 Classifier</title></head>
      <body style="font-family: Arial; padding: 40px; text-align: center;">
        <h2>UDC Classifier (BS 1000A:1961 Edition) - V45</h2>
        <input type="text" id="title" placeholder="Enter title (e.g. Higher education and computers)" style="width: 60%; padding: 10px; font-size: 16px;">
        <button onclick="classify()" style="padding: 10px 20px; font-size: 16px;">Search</button>
        <div id="result" style="margin-top: 30px; font-size: 20px; font-weight: bold; color: green;"></div>
        <script>
          async function classify() {
            const title = document.getElementById('title').value;
            const res = await fetch('/api/classify', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({title})
            });
            const data = await res.json();
            document.getElementById('result').innerText = data.code ? (data.code + ' : ' + data.description) : 'No match found';
          }
        </script>
      </body>
      </html>
    `);
  }
});

app.post('/api/classify', (req, res) => {
  const rawTitle = req.body.title || "";
  const title = rawTitle.toLowerCase().trim();

  if (!title) {
    return res.status(400).json({ error: "Please enter a title." });
  }

  const directMatch = udcData.find(item => 
    item.keywords && item.keywords.some(k => title === k || title.includes(k))
  );

  if (directMatch) {
    return res.json({
      title: rawTitle,
      code: directMatch.code,
      description: directMatch.description,
      standard: "Uploaded UDC BS 1000A:1961 Edition"
    });
  }

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
  console.log(Server is running on port ${PORT});
});
