require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 1. Load Local Reference Index
let udcIndex = [];
try {
  const indexRaw = fs.readFileSync(path.join(__dirname, 'udc-1961-reference-index.json'), 'utf8');
  udcIndex = JSON.parse(indexRaw);
  console.log(`Loaded ${udcIndex.length || Object.keys(udcIndex).length} entries from UDC 1961 index.`);
} catch (err) {
  console.warn('Warning: Could not load udc-1961-reference-index.json. Continuing without local RAG fallback.', err.message);
}

// Helper: Find closest reference records using keyword matching
function findMatchingReferenceEntries(query, limit = 8) {
  if (!Array.isArray(udcIndex)) return [];
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  const matches = udcIndex.filter(entry => {
    const text = `${entry.class_number || entry.code || ''} ${entry.description || entry.title || ''}`.toLowerCase();
    return terms.some(term => text.includes(term));
  });

  return matches.slice(0, limit);
}

// 2. DeepSeek Query Route
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

    // Step A: Retrieve relevant reference items
    const matchedEntries = findMatchingReferenceEntries(query);
    const referenceContext = matchedEntries.length > 0 
      ? `Relevant Reference Entries from UDC 1961 Index:\n${JSON.stringify(matchedEntries, null, 2)}` 
      : 'No exact keyword matches found in local index. Construct using standard UDC 1961 classification principles.';

    // Step B: Formulate system prompt in English
    const systemPrompt = `You are an authoritative classifier specializing in the Universal Decimal Classification (UDC - 1961 Edition).
Task:
Assign the most precise, synthesized UDC class mark according to UDC 1961 rules for the given subject or title.

Strict Rules:
1. Ground your synthesis in the verified UDC 1961 reference records provided below whenever relevant.
2. Use valid 1961 standard connecting symbols and auxiliaries:
   - '+' (Addition / coordination)
   - '/' (Consecutive extension)
   - ':' (Relation / synthesis)
   - '=' (Language auxiliary)
   - '(0...)' (Form auxiliary)
   - '(1/9)' (Place auxiliary)
   - '(=...)' (Race / nationality auxiliary)
   - '""' (Time auxiliary)
   - '-0...' or '.0...' (Special analytical auxiliaries)
3. Do not invent or guess modern UDC revisions not present in the 1961 framework.
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

    // Step C: Call DeepSeek API
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

    // Step D: Validate output structure
    if (!parsedResult.class_number) {
      throw new Error('DeepSeek returned an invalid payload missing "class_number".');
    }

    return res.json({
      success: true,
      query,
      result: parsedResult
    });

  } catch (error) {
    console.error('Classification error:', error);
    
    // Fallback: If AI call fails, return top local match if available
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
