import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(__dirname));

// Load Local UDC & DDC Datasets
let udcIndex = [];
let ddcIndex = [];
let seedUdc = [];

try {
  if (existsSync(join(__dirname, 'udc-1961-reference-index.json'))) {
    udcIndex = JSON.parse(readFileSync(join(__dirname, 'udc-1961-reference-index.json'), 'utf8'));
  }
} catch (e) {
  console.warn('Could not load udc-1961-reference-index.json');
}

try {
  if (existsSync(join(__dirname, 'ddc-23-reference-index.json'))) {
    ddcIndex = JSON.parse(readFileSync(join(__dirname, 'ddc-23-reference-index.json'), 'utf8'));
  }
} catch (e) {
  console.warn('Could not load ddc-23-reference-index.json');
}

try {
  if (existsSync(join(__dirname, 'seed-udc.json'))) {
    seedUdc = JSON.parse(readFileSync(join(__dirname, 'seed-udc.json'), 'utf8'));
  }
} catch (e) {
  console.warn('Could not load seed-udc.json');
}

// DeepSeek Classification Helper
async function classifyWithDeepSeek(title) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are an expert cataloger in Universal Decimal Classification (UDC, BS 1000A:1961).
Classify the following title into an accurate UDC notation.
Title: "${title}"

Return strictly a valid JSON object without markdown formatting:
{
  "udc": "UDC number/notation",
  "heading": "Standard Class Heading/Description",
  "explanation": "Brief synthesis reasoning"
}`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You respond only in clean raw JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek error HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.choices[0]?.message?.content || '{}';
  const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleanJson);
}

// Classification API endpoint
app.post('/api/classify', async (req, res) => {
  const title = (req.body?.title || req.body?.query || '').trim();
  if (!title) {
    return res.status(400).json({ error: 'Title is required.' });
  }

  // 1. First Priority: DeepSeek AI (If API Key is added on Render)
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const aiResult = await classifyWithDeepSeek(title);
      if (aiResult && aiResult.udc) {
        return res.json({
          success: true,
          query: title,
          result: {
            classNumber: aiResult.udc,
            heading: aiResult.heading || 'Classified by DeepSeek',
            explanation: aiResult.explanation || 'Synthesized using official UDC rules',
            edition: 'BS 1000A:1961 / DeepSeek AI',
            source: 'DeepSeek AI'
          }
        });
      }
    } catch (err) {
      console.error('DeepSeek request error:', err.message);
    }
  }

  // 2. Second Priority: Local Historical UDC & Seed Matches
  const lower = title.toLowerCase();
  const found = udcIndex.find(item => 
    (item.title && item.title.toLowerCase() === lower) ||
    (item.heading && item.heading.toLowerCase().includes(lower))
  ) || seedUdc.find(item => 
    (item.title && item.title.toLowerCase() === lower) ||
    (item.heading && item.heading.toLowerCase().includes(lower))
  );

  if (found) {
    return res.json({
      success: true,
      query: title,
      result: {
        classNumber: found.classNumber || found.udc || found.number,
        heading: found.heading || found.description || 'UDC Matched',
        explanation: found.explanation || 'Verified historical entry',
        edition: 'BS 1000A:1961',
        source: 'Local UDC Index'
      }
    });
  }

  // 3. Fallback: Clean response (No client pattern crash)
  return res.json({
    success: true,
    query: title,
    result: {
      classNumber: '0/9',
      heading: 'General / Subject classification pending key validation',
      explanation: 'Connect DEEPSEEK_API_KEY on Render environment for auto-synthesis.',
      edition: 'BS 1000A:1961',
      source: 'System Fallback'
    }
  });
});

// App route
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`UDC Server running on port ${PORT}`);
});
