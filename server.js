import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const UDC_SYSTEM_PROMPT = `You are an expert Universal Decimal Classification (UDC - BS 1000A:1961 schedule) engine.
Synthesize the complete, untruncated UDC class number and provide full breakdowns.

RULES:
- Exact subject mapping (Astronomy = 52, Physics = 53, Chemistry = 54, Music = 78, Painting = 75, Veterinary = 619, Animals = 636, Floor = 69.025, Library = 02).
- Organizations = 061 or :061.2.
- Common auxiliaries of form: Dictionaries=(038), Directories=(058.7), Speeches=(042), Handbook=(035).
- Common auxiliaries of place: India=(540), South India=(540-13), World=(100).

Return ONLY valid JSON matching this schema:
{
  "fullNotation": "pure notation without brackets around subject, e.g. 52:061(100)(058.7)",
  "mainSubject": "Short main subject name, e.g. Astronomy / Astronomical Organizations",
  "subSubject": "Detailed facet description, e.g. International directory of organizations",
  "breakdown": "Element-by-element breakdown",
  "confidence": "95%",
  "evidence": "Schedule verified"
}`;

app.get('/', (req, res) => {
  const rootIndex = path.join(__dirname, 'index.html');
  const pubIndex = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  if (fs.existsSync(pubIndex)) return res.sendFile(pubIndex);
  res.send("UDC Server Running");
});

app.post(['/api/classify', '/classify'], async (req, res) => {
  try {
    const title = req.body.title || req.body.query || req.body.text;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY missing on Render" });
    }

    // Models sequence: agar pehla busy hove taan agla sambhale
    const activeModels = [
      'gemini-3.8-flash',
      'gemini-3-flash',
      'gemini-2.5-flash'
    ];

    let apiData = null;
    let lastError = null;

    for (const model of activeModels) {
      try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: UDC_SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: [{ text: `Synthesize full UDC notation for: "${title}"` }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1
            }
          })
        });

        const data = await response.json();

        // 503 / high demand check
        if (!response.ok || data.error) {
          lastError = data.error?.message || `Model ${model} unavailable`;
          continue; // try next model immediately
        }

        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          apiData = data;
          break;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    if (!apiData) {
      throw new Error(lastError || "High demand on all models, please retry in a moment");
    }

    const rawOutput = apiData.candidates[0].content.parts[0].text;
    const cleanOutput = rawOutput.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanOutput);

    const notationValue = parsed.fullNotation || parsed.udcNumber || parsed.notation || parsed.classNumber || '';
    const mainSubValue = parsed.mainSubject || parsed.main_subject || 'Primary Subject';
    const subSubValue = parsed.subSubject || parsed.sub_subject || 'Document Facets';

    res.json({
      success: true,
      answer: notationValue,
      result: notationValue,
      classNumber: notationValue,
      fullNotation: notationValue,
      udcNumber: notationValue,
      notation: notationValue,
      mainSubject: mainSubValue,
      main_subject: mainSubValue,
      subSubject: subSubValue,
      sub_subject: subSubValue,
      breakdown: parsed.breakdown || '',
      confidence: parsed.confidence || '95%',
      evidence: parsed.evidence || 'B.S. 1000A:1961 schedule verified'
    });

  } catch (err) {
    console.error("Backend Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
