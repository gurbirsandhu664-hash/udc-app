require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const UDC_TABLES = {
  "0": "Science and Knowledge. Computer Science. Librarianship",
  "1": "Philosophy. Psychology",
  "2": "Religion. Theology",
  "3": "Social Sciences. Law. Economics. Education",
  "5": "Mathematics. Natural Sciences",
  "6": "Applied Sciences. Medicine. Technology",
  "7": "The Arts. Music. Sport",
  "8": "Language. Linguistics. Literature",
  "81": "Linguistics and Languages",
  "82": "Literature",
  "821.111": "English Literature",
  "9": "Geography. Biography. History"
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

app.post('/api/classify', async (req, res) => {
  try {
    const { title, author, keywords, description } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Book title is required.' });
    }

    const systemInstruction = `
You are an expert UDC cataloguer. Use Universal Decimal Classification (UDC) ONLY. Never use DDC.
Rules:
- Language is 81, Literature is 82.
- Auxiliaries of form use brackets like (038) for Dictionaries, (031) for Encyclopedias.
- Literary genres use hyphens: -1 Poetry, -2 Drama, -3 Fiction.
- If the title is ambiguous, request more details in infoNeededPrompt.
`;

    const prompt = `Classify this book:
Title: "${title}"
Author: "${author || ''}"
Keywords: "${keywords || ''}"
Description: "${description || ''}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, enum: ["SUCCESS", "MORE_INFO_NEEDED"] },
            finalUdc: { type: Type.STRING },
            mainSubject: { type: Type.STRING },
            subSubject: { type: Type.STRING },
            explanation: { type: Type.STRING },
            confidence: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
            hierarchyBreakdown: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  step: { type: Type.STRING },
                  meaning: { type: Type.STRING }
                },
                required: ["step", "meaning"]
              }
            }
          },
          required: ["status", "finalUdc", "mainSubject", "explanation", "confidence", "hierarchyBreakdown"]
        }
      }
    });

    res.json(JSON.parse(response.text.trim()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ results: [] });
  const results = [];
  Object.entries(UDC_TABLES).forEach(([code, text]) => {
    if (code.includes(q) || text.toLowerCase().includes(q)) {
      results.push({ code, text });
    }
  });
  res.json({ results });
});

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UDC AI Classifier</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 20px; }
    .container { max-width: 700px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    h1 { margin: 0 0 6px; font-size: 1.3rem; }
    p.sub { color: #64748b; margin: 0; font-size: 0.85rem; }
    input, textarea { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.95rem; margin: 6px 0 12px; }
    .btn { cursor: pointer; border: none; padding: 12px; border-radius: 6px; font-weight: 600; font-size: 0.95rem; }
    .btn-primary { background: #0284c7; color: white; width: 100%; }
    .udc-box { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 12px; }
    .udc-num { font-family: monospace; font-size: 2rem; font-weight: bold; color: #0284c7; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
    .badge.High { background: #dcfce7; color: #166534; }
    .badge.Medium { background: #fef9c3; color: #854d0e; }
    .badge.Low { background: #fee2e2; color: #991b1b; }
    .tree-step { font-family: monospace; font-weight: bold; color: #0284c7; margin-right: 8px; }
    .history-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>UDC AI CLASSIFIER</h1>
      <p class="sub">Automatic Universal Decimal Classification for Books</p>
    </div>

    <div class="card">
      <form onsubmit="classify(event)">
        <label><strong>Book Title *</strong></label>
        <input type="text" id="title" placeholder="e.g. Dictionary of Language and Literature" required>
        
        <details style="margin-bottom: 12px;">
          <summary style="cursor: pointer; color: #64748b; font-size: 0.85rem;">Optional Fields (Author, Keywords)</summary>
          <input type="text" id="author" placeholder="Author (Optional)">
          <input type="text" id="keywords" placeholder="Keywords (Optional)">
        </details>

        <button type="submit" id="btn" class="btn btn-primary">GET UDC NUMBER</button>
      </form>
    </div>

    <div id="resCard" class="card" style="display: none;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.75rem; font-weight: bold; color: #64748b;">FINAL UDC NUMBER</span>
        <span id="badge" class="badge"></span>
      </div>
      <div class="udc-box">
        <div class="udc-num" id="udcNum"></div>
        <button onclick="copyUdc()" class="btn" style="background: #f1f5f9; padding: 8px 12px;">Copy UDC</button>
      </div>
      <p><strong>Subject:</strong> <span id="subject"></span></p>
      <p><strong>Sub Subject:</strong> <span id="subSubject"></span></p>
      <p><strong>Explanation:</strong> <span id="exp"></span></p>
      <div id="tree"></div>
    </div>

    <div class="card">
      <h3 style="margin: 0 0 10px; font-size: 1rem;">Classification History</h3>
      <div id="history"></div>
    </div>
  </div>

  <script>
    renderHistory();

    async function classify(e) {
      e.preventDefault();
      const btn = document.getElementById('btn');
      btn.innerText = 'Analyzing...'; btn.disabled = true;

      try {
        const title = document.getElementById('title').value;
        const res = await fetch('/api/classify', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            title,
            author: document.getElementById('author').value,
            keywords: document.getElementById('keywords').value
          })
        });

        const d = await res.json();
        if (d.error) throw new Error(d.error);

        document.getElementById('udcNum').innerText = d.finalUdc;
        document.getElementById('subject').innerText = d.mainSubject;
        document.getElementById('subSubject').innerText = d.subSubject || '—';
        document.getElementById('exp').innerText = d.explanation;

        const badge = document.getElementById('badge');
        badge.innerText = d.confidence + ' Confidence';
        badge.className = 'badge ' + d.confidence;

        const tree = document.getElementById('tree');
        tree.innerHTML = '<strong>Hierarchy Breakdown:</strong><br>';
        d.hierarchyBreakdown.forEach(b => {
          tree.innerHTML += '<div><span class="tree-step">' + b.step + '</span> &rarr; ' + b.meaning + '</div>';
        });

        document.getElementById('resCard').style.display = 'block';
        saveHistory(title, d.finalUdc);
      } catch(err) {
        alert('Error: ' + err.message);
      } finally {
        btn.innerText = 'GET UDC NUMBER'; btn.disabled = false;
      }
    }

    function copyUdc() {
      const num = document.getElementById('udcNum').innerText;
      navigator.clipboard.writeText(num);
      alert('Copied: ' + num);
    }

    function saveHistory(title, udc) {
      const hist = JSON.parse(localStorage.getItem('udc_hist') || '[]');
      hist.unshift({ title, udc, date: new Date().toLocaleDateString() });
      localStorage.setItem('udc_hist', JSON.stringify(hist.slice(0, 5)));
      renderHistory();
    }

    function renderHistory() {
      const hist = JSON.parse(localStorage.getItem('udc_hist') || '[]');
      const el = document.getElementById('history');
      if (!hist.length) { el.innerHTML = '<span style="color:#64748b;">No history yet.</span>'; return; }
      el.innerHTML = hist.map(h => '<div class="history-row"><span>' + h.title + '</span><strong><code>' + h.udc + '</code></strong><span>' + h.date + '</span></div>').join('');
    }
  </script>
</body>
</html>`);
});

app.listen(PORT, () => console.log('Server started on http://localhost:' + PORT));
