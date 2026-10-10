import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Load local reference index file
let udcIndex = [];
try {
  const indexPath = path.join(__dirname, 'udc-1961-reference-index.json');
  if (fs.existsSync(indexPath)) {
    const indexRaw = fs.readFileSync(indexPath, 'utf8');
    udcIndex = JSON.parse(indexRaw);
  }
} catch (err) {
  console.warn('Index load error:', err.message);
}

function findMatchingReferenceEntries(query, limit = 8) {
  if (!Array.isArray(udcIndex)) return [];
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  return udcIndex.filter(entry => {
    const text = `${entry.class_number || entry.code || ''} ${entry.description || entry.title || ''}`.toLowerCase();
    return terms.some(term => text.includes(term));
  }).slice(0, limit);
}

app.post('/api/classify', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query string is required.' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'DEEPSEEK_API_KEY environment variable is not configured.' });
    }

    const matchedEntries = findMatchingReferenceEntries(query);
    const referenceContext = matchedEntries.length > 0 
      ? `Relevant Reference Entries from UDC 1961 Index:\n${JSON.stringify(matchedEntries, null, 2)}` 
      : 'No exact keyword matches found in local index. Construct using standard UDC 1961 classification principles.';

    const systemPrompt = `You are an authoritative classifier specializing in the Universal Decimal Classification (UDC - 1961 Edition).
Task: Assign the most precise, synthesized UDC class mark according to UDC 1961 rules for the given subject or title.

Strict Rules:
1. Ground your synthesis in verified UDC 1961 reference records whenever relevant.
2. Use valid 1961 standard connecting symbols and auxiliaries:
   - '+' (Addition)
   - '/' (Extension)
   - ':' (Relation)
   - '=' (Language)
   - '(0...)' (Form)
   - '(1/9)' (Place)
   - '""' (Time)
   - '-0...' or '.0...' (Special analytical auxiliaries)
3. Do not invent modern notations not in the 1961 framework.
4. Output MUST be a valid JSON object matching this schema:
{
  "class_number": "<Synthesized UDC number>",
  "description": "<Concise official subject heading>",
  "breakdown": [
    {
      "component": "<Code fragment>",
      "meaning": "<Component interpretation>"
    }
  ]
}

${referenceContext}`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Classify the following topic/book title: "${query}"` }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    const parsedResult = JSON.parse(rawContent);

    if (!parsedResult.class_number) {
      throw new Error('DeepSeek returned an invalid payload missing class_number.');
    }

    return res.json({
      success: true,
      query,
      result: parsedResult
    });

  } catch (error) {
    console.error('Classification error:', error);
    
    const fallbackMatches = findMatchingReferenceEntries(req.body?.query || '', 1);
    if (fallbackMatches.length > 0) {
      const fallback = fallbackMatches[0];
      return res.json({
        success: true,
        fallback: true,
        result: {
          class_number: fallback.class_number || fallback.code,
          description: fallback.description || fallback.title,
          breakdown: [{ component: fallback.class_number || fallback.code, meaning: 'Exact local match' }]
        }
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to process classification request.' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
