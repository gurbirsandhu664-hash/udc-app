const express = require('express');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

function askAIClassifier(title, apiKey) {
  return new Promise((resolve, reject) => {
    const prompt = `You are a certified expert in Library Classification following STRICTLY the Universal Decimal Classification (UDC) BS 1000A:1961 Edition.
Analyze and classify the given book title or subject into its exact UDC number and facets.
Title: "${title}"

Strict Rules:
1. Higher education = 378, Computers = 681.14.
2. History of India = 94(540).
3. Religious Unrest in India = 2-674(540).
4. A handbook of ethics of librarians = 02:17(035).
5. Knowledge Metaphysics and Logic = 001 + 111 + 16.
6. Biography of Dr S.R. Ranganathan = 929(Ranganathan).
7. English drama = 820-2.
8. Science and technology = 5/6.
9. Research on Sacred Literature = 2.001.5 or 2:001.5 (or respective schedule with research viewpoint .001.5).
10. Use exact UDC signs: Colon (:), Plus (+), Stroke (/), Place (1/9), Form (0...), Viewpoint (.00...).

Respond strictly in valid JSON format only, with no markdown formatting, using this exact schema:
{
  "code": "EXACT_UDC_NUMBER",
  "description": "Short description of the classification",
  "breakdown": [
    {"part": "FACET_CODE", "label": "Meaning of facet"}
  ]
}`;

    const data = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
        .code { font-size: 28px; font-weight: bold; color: #1e40af; font-family: monospace; }
        .desc { font-size: 16px; color: #374151; margin-top: 6px; }
        .breakdown-box { margin-top: 15px; padding-top: 12px; border-top: 1px dashed #cbd5e1; }
        .item-row { font-size: 14px; color: #475569; margin: 4px 0; }
        .badge { background: #e0e7ff; color: #3730a3; padding: 2px 7px; border-radius: 4px; font-family: monospace; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>UDC Classifier (BS 1000A:1961)</h2>
        <p>AI-Powered Intelligent UDC Engine</p>
        <input type="text" id="subject" placeholder="e.g. Research on Sacred Literature">
        <button onclick="run()">Classify</button>
        <div id="resBox" class="res">
          <div><strong>UDC Code:</strong> <span id="outCode" class="code"></span></div>
          <div class="desc"><strong>Description:</strong> <span id="outDesc"></span></div>
          <div id="breakdownSection" class="breakdown-box">
            <strong>Facet Breakdown:</strong>
            <div id="breakdownList"></div>
          </div>
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

          let listHtml = '';
          if(d.breakdown && d.breakdown.length > 0) {
            d.breakdown.forEach(item => {
              listHtml += '<div class="item-row"><span class="badge">' + item.part + '</span> ' + item.label + '</div>';
            });
          }
          document.getElementById('breakdownList').innerHTML = listHtml;
        }
      </script>
    </body>
    </html>
  `);
});

app.post('/api/classify', async (req, res) => {
  const title = req.body.title || "";
  if (!title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ code: "ERROR", description: "GEMINI_API_KEY is not set in Render Environment variables." });
  }

  try {
    const aiRes = await askAIClassifier(title, apiKey);
    return res.json(aiRes);
  } catch (e) {
    return res.status(500).json({ code: "Error", description: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log("UDC Engine live on port " + PORT);
});
