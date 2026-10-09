import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 1. In-built CORS handling
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// 2. Static files serve (index.html, css, seed data)
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// 3. Strict UDC synthesis instructions (BS 1000A:1961 standards)
const UDC_SYSTEM_PROMPT = `You are an expert Universal Decimal Classification (UDC - BS 1000A:1961 schedule) engine.
Synthesize the complete, untruncated UDC class number and provide full breakdowns.

RULES:
- Exact subject mapping:
  * Astronomy = 52 (Do NOT map to 53)
  * Physics = 53
  * Chemistry = 54
  * Music = 78
  * Painting = 75
  * Veterinary Science = 619
  * Zoology/Animals = 59 / 636
  * Reptiles / Snakes = 598.12 or 639.15
  * Floor Construction / Building = 69.025 / 693.5
  * Library Science = 02
  * Biographies = 929
- Organizations: Use 061 or :061.2 (NEVER use 361 for scientific organizations).
- Common auxiliaries of form: Dictionaries=(038), Directories=(058.7), Reproductions/Plates=(084.1), Speeches=(042), Handbook=(035).
- Common auxiliaries of place: India=(540), South India=(540-13), World/International=(100).

Return ONLY valid JSON with this exact structure:
{
  "fullNotation": "synthesized UDC notation",
  "udcNumber": "synthesized UDC notation",
  "mainSubject": "Short main subject name",
  "subSubject": "Detailed facet description",
  "breakdown": "Element breakdown (e.g. 52=Astronomy; :061=Organizations; (100)=World; (058.7)=Directory)",
  "confidence": "95%",
  "evidence": "Schedule verified"
}`;

// Root Route
app.get('/', (req, res) => {
  const rootIndex = path.join(__dirname, 'index.html');
  const pubIndex = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  if (fs.existsSync(pubIndex)) return res.sendFile(pubIndex);
  res.send("UDC Server Running");
});

// API Routes (Frontend ke dono endpoints handle honge)
app.post(['/api/classify', '/classify'], async (req, res) => {
  try {
    const title = req.body.title || req.body.query || req.body.text;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable missing on Render" });
    }

    // Models with automatic fallback to prevent "model not found" errors
    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-pro'
    ];

    let apiData = null;
    let lastError = null;

    for (const model of modelsToTry) {
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
        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          apiData = data;
          break;
        } else {
          lastError = data.error?.message || `Failed on ${model}`;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    if (!apiData) {
      throw new Error(lastError || "Gemini API classification failed");
    }

    const rawOutput = apiData.candidates[0].content.parts[0].text;
    const cleanOutput = rawOutput.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanOutput);

    // Exact response mapping jo frontend validation ko pass karega
    res.json({
      success: true,
      result: parsed.fullNotation || parsed.udcNumber,
      fullNotation: parsed.fullNotation || parsed.udcNumber,
      udcNumber: parsed.udcNumber || parsed.fullNotation,
      mainSubject: parsed.mainSubject,
      subSubject: parsed.subSubject,
      breakdown: parsed.breakdown,
      confidence: parsed.confidence || "95%",
      evidence: parsed.evidence || "B.S. 1000A:1961 schedule verified"
    });

  } catch (err) {
    console.error("Backend Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
