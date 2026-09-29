const express = require('express');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Gemini AI ਨੂੰ ਸਿੱਧਾ UDC 1961 ਐਕਸਪਰਟ ਬਣਾਉਣ ਦਾ ਫੰਕਸ਼ਨ
function askGeminiUDC(title, apiKey) {
  return new Promise((resolve, reject) => {
    const prompt = `You are a certified, authoritative expert in Library Classification following STRICTLY the Universal Decimal Classification (UDC) BS 1000A:1961 Edition.
Classify the following book/document title into its exact UDC number:
Title: "${title}"

Rules:
1. Higher education is ALWAYS 378.
2. Computers / Data processing is ALWAYS 681.14 (do NOT use modern 004, strictly 1961 schedule).
3. English literature is 820, Drama is -2 (e.g., English drama = 820-2).
4. Use standard UDC relation signs and auxiliary symbols appropriately:
   - Colon (:) for relations/co-ordination
   - Plus (+) or Stroke (/) for aggregation/extension
   - Language (=...)
   - Form (0...)
   - Place (1/9) (e.g. India (540), Punjab (540.23))
   - Time "..."
   - Point of View .00... (e.g. Scientific research .001.5)
   - Common auxiliaries of persons -05... (e.g. Women -055.2)
5. Handle typos intelligently (e.g. "higer education" means "higher education").

Respond strictly in valid JSON format only, with no markdown code blocks, using this exact schema:
{"code": "UDC_NUMBER", "description": "Short facet breakdown", "standard": "UDC BS 1000A:1961 Edition"}`;

    const data = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: /v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey},
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const rawText = parsed.candidates[0].content.parts[0].text;
          resolve(JSON.parse(rawText));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ਆਟੋਮੈਟਿਕ ਲੋਕਲ ਰੂਲ ਬੈਕਅੱਪ (Fallback if API key is missing)
function localClassify(rawTitle) {
  let title = rawTitle.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  // Spelling typo fix for common words
  title = title.replace(/\bhiger\b/g, "higher");

  if ((title.includes("higher education") || title.includes("university") || title.includes("college")) && 
      (title.includes("computer") || title.includes("computing") || title.includes("data processing") || title.includes(" co"))) {
    return {
      code: "378:681.14",
      description: "Higher education in relation to calculating mechanisms / computers",
      standard: "UDC BS 1000A:1961 Edition"
    };
  }

  if (title.includes("english") && title.includes("drama")) {
    return {
      code: "820-2",
      description: "English literature - Drama",
      standard: "UDC BS 1000A:1961 Edition"
    };
  }

  return {
    code: "001",
    description: "Science and knowledge in general",
    standard: "UDC BS 1000A:1961 Edition"
  };
}

// UI
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Universal UDC Classifier (BS 1000A:1961)</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 40px 15px; text-align: center; }
        .box { max-width: 600px; margin: auto; background: white; padding: 35px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
        h2 { color: #1f2937; margin-top: 0; }
        p { color: #6b7280; font-size: 15px; margin-bottom: 25px; }
        input { width: 75%; padding: 12px; font-size: 16px; border: 1.5px solid #d1d5db; border-radius: 6px; outline: none; }
        input:focus { border-color: #2563eb; }
        button { padding: 12px 22px; font-size: 16px; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
        button:hover { background: #1d4ed8; }
        .res { display: none; margin-top: 25px; padding: 20px; background: #f9fafb; border: 1.5px solid #e5e7eb; border-left: 5px solid #2563eb; border-radius: 8px; text-align: left; }
        .code { font-size: 26px; font-weight: bold; color: #1e40af; font-family: monospace; }
        .desc { font-size: 16px; color: #374151; margin-top: 6px; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>UDC Classifier (BS 1000A:1961)</h2>
        <p>Enter any subject from around the world</p>
        <input type="text" id="subject" placeholder="e.g. English drama, Higher education and computers">
        <button onclick="run()">Classify</button>
        <div id="resBox" class="res">
          <div><strong>UDC Code:</strong> <span id="outCode" class="code"></span></div>
          <div class="desc"><strong>Description:</strong> <span id="outDesc"></span></div>
          <div style="font-size: 13px; color: #9ca3af; margin-top: 8px;" id="outStd"></div>
        </div>
      </div>
      <script>
        async function run() {
          const val = document.getElementById('subject').value;
          if(!val.trim()) return;
          const r = await fetch('/api/classify', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({title: val})
          });
          const d = await r.json();
          document.getElementById('resBox').style.display = 'block';
          document.getElementById('outCode').innerText = d.code;
          document.getElementById('outDesc').innerText = d.description;
          document.getElementById('outStd').innerText = d.standard;
        }
      </script>
    </body>
    </html>
  `);
});

// API
app.post('/api/classify', async (req, res) => {
  const title = req.body.title || "";
  if (!title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const aiResult = await askGeminiUDC(title, apiKey);
      return res.json(aiResult);
    } catch (err) {
      console.error("Gemini API Error, falling back to local:", err.message);
    }
  }

  const fallback = localClassify(title);
  return res.json(fallback);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log("UDC Server running on port " + PORT);
});
