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
- Exact subject mapping (Astronomy = 52, Physics = 53, Chemistry = 54, Music = 78, Painting = 75, Veterinary = 619, Reptiles/Snakes = 598.12 or 639.15).
- Organizations = 061 or :061.2 (NEVER use 361 for scientific organizations).
- Common auxiliaries of form: Dictionaries=(038), Directories=(058.7), Reproductions/Plates=(084.1), Speeches=(042).
- Common auxiliaries of place: India=(540), South India=(540-13), World=(100).

Return ONLY a JSON matching this structure:
{
  "udcNumber": "exact synthesized notation",
  "fullNotation": "exact synthesized notation",
  "mainSubject": "Short main discipline name",
  "subSubject": "Detailed facet description",
  "breakdown": "Step-by-step element breakdown (e.g. 75=Painting; (540)=India)",
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

// Handle both standard classification endpoints
app.post(['/api/classify', '/classify'], async (req, res) => {
  try {
    const title = req.body.title || req.body.query || req.body.text;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing" });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const apiResponse = await fetch(apiUrl, {
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

    const data = await apiResponse.json();
    if (!apiResponse.ok) {
      throw new Error(data.error?.message || "Google Gemini API error");
    }

    const parsed = JSON.parse(data.candidates[0].content.parts[0].text);
    
    // Response mapped for all possible frontend key names
    res.json({
      success: true,
      result: parsed.fullNotation || parsed.udcNumber,
      fullNotation: parsed.fullNotation || parsed.udcNumber,
      udcNumber: parsed.udcNumber || parsed.fullNotation,
      mainSubject: parsed.mainSubject,
      subSubject: parsed.subSubject,
      breakdown: parsed.breakdown,
      confidence: parsed.confidence || "90%",
      evidence: parsed.evidence || "B.S. 1000A:1961"
    });

  } catch (err) {
    console.error("Backend Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
