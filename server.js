import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Load Local Database
let udcIndex = [];
let seedUdc = [];

try {
  const p = join(__dirname, 'udc-1961-reference-index.json');
  if (existsSync(p)) udcIndex = JSON.parse(readFileSync(p, 'utf8'));
} catch (e) {
  console.warn('Local UDC index loading skipped');
}

try {
  const p = join(__dirname, 'seed-udc.json');
  if (existsSync(p)) seedUdc = JSON.parse(readFileSync(p, 'utf8'));
} catch (e) {
  console.warn('Seed index loading skipped');
}

// DeepSeek AI Helper
async function classifyWithDeepSeek(title) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are an expert Universal Decimal Classification (UDC, BS 1000A:1961) classifier.
Classify this title: "${title}".
Return strictly valid JSON only:
{
  "classNumber": "UDC notation",
  "heading": "Heading name",
  "explanation": "Brief reasoning",
  "edition": "B.S. 1000A:1961"
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
        { role: 'system', content: 'You respond strictly in clean raw JSON without backticks.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    })
  });

  if (!response.ok) throw new Error(`DeepSeek error HTTP ${response.status}`);
  const data = await response.json();
  const rawText = data.choices[0]?.message?.content || '{}';
  const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleanJson);
}

// Handler for classification requests
async function handleClassification(req, res) {
  const title = (req.body?.title || req.body?.query || req.query?.title || req.query?.query || '').trim();

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // 1. Check DeepSeek first if API key is present
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const ai = await classifyWithDeepSeek(title);
      if (ai && (ai.classNumber || ai.udc)) {
        const classNum = String(ai.classNumber || ai.udc).trim();
        return res.json({
          success: true,
          query: title,
          title: title,
          classNumber: classNum,
          udc: classNum,
          heading: ai.heading || 'UDC Synthesis',
          explanation: ai.explanation || 'Classified via DeepSeek',
          edition: 'B.S. 1000A:1961',
          source: 'DeepSeek AI'
        });
      }
    } catch (err) {
      console.error('DeepSeek AI Error:', err.message);
    }
  }

  // 2. Local Fallback Search
  const lower = title.toLowerCase();
  const allData = [...udcIndex, ...seedUdc];
  const found = allData.find(item => {
    const itemTitle = (item.title || item.heading || '').toLowerCase();
    return itemTitle === lower || itemTitle.includes(lower);
  });

  if (found) {
    const classNum = String(found.classNumber || found.udc || found.number || '0/9').trim();
    return res.json({
      success: true,
      query: title,
      title: title,
      classNumber: classNum,
      udc: classNum,
      heading: found.heading || found.title || 'UDC Entry',
      explanation: found.explanation || 'Verified local index entry',
      edition: 'B.S. 1000A:1961',
      source: 'Local Index'
    });
  }

  // 3. Fallback Response (Safari error bypass)
  return res.json({
    success: true,
    query: title,
    title: title,
    classNumber: '0',
    udc: '0',
    heading: 'Generalities / Subject Classification',
    explanation: 'Classification pending key verification or specific entry.',
    edition: 'B.S. 1000A:1961',
    source: 'General System'
  });
}

// Support all app API routes
app.all('/api/classify', handleClassification);
app.all('/api/synthesize', handleClassification);
app.all('/api/search', handleClassification);

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started successfully on port ${PORT}`);
});
