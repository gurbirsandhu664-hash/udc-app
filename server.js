const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Local database load
let udcIndex = [];
try {
  const filePath = path.join(__dirname, 'udc-1961-reference-index.json');
  if (fs.existsSync(filePath)) {
    udcIndex = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log('UDC 1961 reference loaded successfully.');
  }
} catch (e) {
  console.log('Index file read notice:', e.message);
}

function getLocalMatches(query, limit = 6) {
  if (!Array.isArray(udcIndex)) return [];
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  return udcIndex.filter(item => {
    const text = `${item.class_number || item.code || ''} ${item.description || item.title || ''}`.toLowerCase();
    return words.some(w => text.includes(w));
  }).slice(0, limit);
}

app.post('/api/classify', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'DEEPSEEK_API_KEY is missing in Render Environment' });
    }

    const matches = getLocalMatches(query);
    const contextText = matches.length 
      ? `Reference UDC 1961 entries:\n${JSON.stringify(matches)}` 
      : 'Use UDC 1961 standard schedules.';

    const systemPrompt = `You are an expert UDC (Universal Decimal Classification - 1961 Edition) classifier.
Provide the exact UDC 1961 number for the subject.
Rules:
1. Use standard auxiliary signs: ':' (relation), '+' (addition), '/' (extension), '=' (language), '(0...)' (form), '(1/9)' (place), '""' (time).
2. Never invent modern notations outside UDC 1961.
3. Respond ONLY with raw JSON:
{
  "class_number": "UDC class number",
  "description": "Subject description",
  "breakdown": [{"component": "code", "meaning": "interpretation"}]
}

${contextText}`;

    const apiRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Classify: ${query}` }
        ]
      })
    });

    if (!apiRes.ok) {
      const err = await apiRes.text();
      throw new Error(`DeepSeek API error: ${err}`);
    }

    const json = await apiRes.json();
    const result = JSON.parse(json.choices[0].message.content);

    return res.json({ success: true, result });
  } catch (err) {
    console.error('Error:', err.message);
    const fallback = getLocalMatches(req.body ? req.body.query : '', 1);
    if (fallback.length) {
      const f = fallback[0];
      return res.json({
        success: true,
        fallback: true,
        result: {
          class_number: f.class_number || f.code,
          description: f.description || f.title,
          breakdown: [{ component: f.class_number || f.code, meaning: 'Local Index Match' }]
        }
      });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
