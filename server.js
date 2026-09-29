const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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

// UI Route
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>UDC V45 Classifier</title>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f4f6f8; }
        .box { background: white; max-width: 550px; margin: auto; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        input { width: 80%; padding: 12px; margin-bottom: 15px; font-size: 16px; border: 1px solid #ccc; border-radius: 4px; }
        button { padding: 12px 24px; font-size: 16px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
        #result { margin-top: 25px; font-size: 18px; text-align: left; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>UDC V45 Classifier (1961 Edition)</h2>
        <input type="text" id="title" placeholder="e.g. Higher education and computers">
        <br>
        <button onclick="classify()">Classify</button>
        <div id="result"></div>
      </div>
      <script>
        async function classify() {
          const title = document.getElementById('title').value;
          const out = document.getElementById('result');
          out.innerHTML = "Processing...";
          try {
            const res = await fetch('/api/classify', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({title})
            });
            const data = await res.json();
            out.innerHTML = '<p><strong>UDC Code:</strong> ' + data.code + '</p>' +
                            '<p><strong>Description:</strong> ' + data.description + '</p>' +
                            '<p><strong>Standard:</strong> ' + data.standard + '</p>';
          } catch(e) {
            out.innerHTML = '<span style="color:red;">Server Connection Failed</span>';
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Classify API
app.post('/api/classify', (req, res) => {
  const rawTitle = req.body.title || "";
  const title = rawTitle.toLowerCase().trim();

  if (!title) {
    return res.status(400).json({ error: "Please enter a title." });
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
      standard: "UDC BS 1000A:1961 Edition"
    });
  } else if (detectedCodes.length === 1) {
    return res.json({
      title: rawTitle,
      code: detectedCodes[0],
      description: "Base class match from 1961 schedule",
      standard: "UDC BS 1000A:1961 Edition"
    });
  }

  return res.json({
    title: rawTitle,
    code: "001",
    description: "Science and knowledge in general",
    standard: "Fallback classification"
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server is running on port ' + PORT);
});
