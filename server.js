import express from 'express';
import OpenAI from 'openai';

const app = express();
const port = process.env.PORT || 3000;

// Initialize DeepSeek API client via OpenAI SDK
const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY
});

app.use(express.json());

// UI Route (HTML, CSS, and Client JS)
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UDC Classification Tool</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f8fafc;
      margin: 0;
      padding: 16px;
      display: flex;
      justify-content: center;
    }
    .container {
      max-width: 480px;
      width: 100%;
    }
    h2 {
      margin: 0 0 12px;
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
    }
    .banner {
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      border-radius: 14px;
      padding: 14px;
      margin-bottom: 20px;
    }
    .banner-title {
      font-size: 13px;
      font-weight: 800;
      color: #3730a3;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .banner-sub {
      font-size: 12px;
      color: #4338ca;
      line-height: 1.4;
      font-weight: 600;
    }
    .input-box {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    input {
      flex: 1;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid #cbd5e1;
      font-size: 15px;
      outline: none;
    }
    input:focus { border-color: #6366f1; }
    button {
      padding: 12px 18px;
      border: none;
      background: #4f46e5;
      color: white;
      font-weight: 700;
      border-radius: 12px;
      cursor: pointer;
    }
    button:disabled { background: #94a3b8; }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 14px;
      margin-bottom: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .card-label {
      font-size: 11px;
      font-weight: 800;
      color: #64748b;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .card-content {
      font-size: 15px;
      color: #1e293b;
      line-height: 1.4;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .badge {
      background: #dcfce7;
      color: #166534;
      font-size: 14px;
      font-weight: 700;
      padding: 10px 14px;
      border-radius: 12px;
      text-align: center;
      margin-top: 10px;
    }
    .loading { text-align: center; color: #64748b; margin: 20px 0; display: none; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Science</h2>
    
    <div class="banner">
      <div class="banner-title">FULL-TITLE / FULL-NOTATION MODE:</div>
      <div class="banner-sub">every letter, digit, decimal point, auxiliary, bracket, quote and suffix is preserved in the answer.</div>
    </div>

    <div class="input-box">
      <input type="text" id="query" placeholder="Enter title or subject..." />
      <button id="submitBtn" onclick="classify()">Classify</button>
    </div>

    <div id="loader" class="loading">Classifying, please wait...</div>

    <div id="results" style="display: none;">
      <div class="card">
        <div class="card-label">Main Subject</div>
        <div class="card-content" id="mainSubject">-</div>
      </div>

      <div class="card">
        <div class="card-label">Sub Subject</div>
        <div class="card-content" id="subSubject">-</div>
      </div>

      <div class="card">
        <div class="card-label">UDC Notation Breakdown</div>
        <div class="card-content" id="notationBreakdown">-</div>
      </div>

      <div class="card">
        <div class="card-label">Confidence / Evidence</div>
        <div class="card-content" id="confidence">-</div>
      </div>

      <div class="card">
        <div class="card-label">Notation Audit</div>
        <div class="card-content" id="notationAudit">-</div>
      </div>

      <div class="card">
        <div class="card-label">Explanation</div>
        <div class="card-content" id="explanation">-</div>
      </div>

      <div class="card">
        <div class="card-label">Sources</div>
        <div class="card-content" id="sources">-</div>
      </div>

      <div class="badge" id="classificationResult">
        Classification result
      </div>
    </div>
  </div>

  <script>
    // Converts raw values, arrays, and nested objects into readable strings
    function safeRender(value) {
      if (value === null || value === undefined) return '-';
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (Array.isArray(value)) {
        return value.map(item => safeRender(item)).join('\\n');
      }
      if (typeof value === 'object') {
        return Object.entries(value)
          .map(([k, v]) => \`\${k}: \${typeof v === 'object' ? JSON.stringify(v) : v}\`)
          .join('\\n');
      }
      return JSON.stringify(value, null, 2);
    }

    async function classify() {
      const q = document.getElementById('query').value.trim();
      if (!q) return;

      const btn = document.getElementById('submitBtn');
      const loader = document.getElementById('loader');
      const results = document.getElementById('results');

      btn.disabled = true;
      loader.style.display = 'block';
      results.style.display = 'none';

      try {
        const res = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q })
        });
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        document.getElementById('mainSubject').innerText = safeRender(data.mainSubject);
        document.getElementById('subSubject').innerText = safeRender(data.subSubject);
        document.getElementById('notationBreakdown').innerText = safeRender(data.notationBreakdown);
        document.getElementById('confidence').innerText = safeRender(data.confidence);
        document.getElementById('notationAudit').innerText = safeRender(data.notationAudit);
        document.getElementById('explanation').innerText = safeRender(data.explanation);
        document.getElementById('sources').innerText = safeRender(data.sources);

        if (data.classificationResult) {
          document.getElementById('classificationResult').innerText = safeRender(data.classificationResult);
        }

        results.style.display = 'block';
      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        btn.disabled = false;
        loader.style.display = 'none';
      }
    }
  </script>
</body>
</html>`);
});

// DeepSeek API Endpoint
app.post('/api/classify', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `You are an expert in Universal Decimal Classification (UDC). Return strictly valid JSON with flat string values for each field.
Do not nest objects or arrays inside any value.

{
  "mainSubject": "string",
  "subSubject": "string",
  "notationBreakdown": "formatted string breakdown",
  "confidence": "string",
  "notationAudit": "string",
  "explanation": "string",
  "sources": "string",
  "classificationResult": "string"
}`
        },
        {
          role: 'user',
          content: `Classify the following topic/title using UDC rules: "${query}"`
        }
      ],
      response_format: { type: 'json_object' }
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    res.json(parsed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
