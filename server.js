const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// 1. Load Local Reference Files
let udcIndex = [];
let ddcIndex = [];

try {
  const udcPath = path.join(__dirname, 'udc-1961-reference-index.json');
  if (fs.existsSync(udcPath)) {
    udcIndex = JSON.parse(fs.readFileSync(udcPath, 'utf8'));
    console.log('UDC 1961 index loaded successfully.');
  }
} catch (e) {
  console.log('UDC index load notice:', e.message);
}

try {
  const ddcPath = path.join(__dirname, 'ddc-23-reference-index.json');
  if (fs.existsSync(ddcPath)) {
    ddcIndex = JSON.parse(fs.readFileSync(ddcPath, 'utf8'));
    console.log('DDC 23 index loaded successfully.');
  }
} catch (e) {
  console.log('DDC index load notice:', e.message);
}

// 2. Local Match Helper
function getLocalMatches(queryText, limit = 8) {
  if (!queryText) return [];
  const words = queryText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const combined = Array.isArray(udcIndex) ? udcIndex : Object.values(udcIndex || {});
  
  return combined.filter(item => {
    const text = `${item.class_number || item.code || item.number || ''} ${item.description || item.title || item.heading || ''}`.toLowerCase();
    return words.some(w => text.includes(w));
  }).slice(0, limit);
}

// 3. Classification Handler
async function handleClassification(req, res) {
  try {
    const userQuery = req.body?.query || req.body?.title || req.body?.text || req.body?.subject || req.body?.input || req.query?.q || req.query?.query;

    if (!userQuery || !userQuery.trim()) {
      return res.status(400).json({ error: 'Query is required', message: 'Query is required' });
    }

    const trimmedQuery = userQuery.trim();
    const apiKey = process.env.DEEPSEEK_API_KEY;

    const localRefs = getLocalMatches(trimmedQuery);
    const referenceContext = localRefs.length > 0
      ? `VERIFIED LOCAL INDEX MATCHES:\n${JSON.stringify(localRefs, null, 2)}`
      : 'No direct local index match. Rely strictly on official 1961 UDC rules.';

    if (!apiKey) {
      if (localRefs.length > 0) {
        const top = localRefs[0];
        const num = top.class_number || top.code || top.number || '000';
        const desc = top.description || top.title || top.heading || trimmedQuery;
        return res.json({
          success: true,
          class_number: num,
          number: num,
          description: desc,
          result: { class_number: num, description: desc }
        });
      }
      return res.status(500).json({ error: 'DEEPSEEK_API_KEY missing and no local match found.' });
    }

    const systemPrompt = `You are the master authority on Universal Decimal Classification (UDC - 1961 Edition).
Your task is to classify the title/topic accurately according to the 1961 schedules.

CRITICAL INSTRUCTIONS:
1. Always base your answer on the provided verified local reference data whenever applicable.
2. Standard UDC 1961 notation rules:
   - Use ':' for relation/combination
   - Use '+' for coordination/addition
   - Use '/' for extension
   - Use '(0...)' for form
   - Use '(1/9)' for place
   - Use '""' for time
   - Use '=' for language
3. Provide ONLY valid JSON without backticks:
{
  "class_number": "<UDC Number>",
  "description": "<Official Subject Heading>",
  "breakdown": [
    { "component": "<Part>", "meaning": "<Meaning>" }
  ]
}

${referenceContext}`;

    // OpenRouter API Call for DeepSeek
    const apiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://udc-app.onrender.com',
        'X-Title': 'UDC Classification App'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Classify: ${trimmedQuery}` }
        ]
      })
    });

    if (!apiRes.ok) {
      const errorText = await apiRes.text();
      throw new Error(`OpenRouter API error (${apiRes.status}): ${errorText}`);
    }

    const data = await apiRes.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    const finalNumber = parsed.class_number || parsed.number || '000';
    const finalDesc = parsed.description || trimmedQuery;

    return res.json({
      success: true,
      query: trimmedQuery,
      class_number: finalNumber,
      number: finalNumber,
      description: finalDesc,
      breakdown: parsed.breakdown || [],
      result: parsed
    });

  } catch (err) {
    console.error('Processing error:', err.message);
    const q = req.body?.query || req.body?.title || '';
    const fallbackList = getLocalMatches(q, 1);
    
    if (fallbackList.length > 0) {
      const top = fallbackList[0];
      const num = top.class_number || top.code || top.number || '000';
      const desc = top.description || top.title || top.heading || q;
      return res.json({
        success: true,
        fallback: true,
        class_number: num,
        number: num,
        description: desc,
        result: { class_number: num, description: desc }
      });
    }

    return res.status(500).json({ error: err.message || 'Classification failed' });
  }
}

app.post('/api/classify', handleClassification);
app.post('/classify', handleClassification);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
