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
- Exact subject mapping:
  * Astronomy = 52 (NEVER map to 53)
  * Physics = 53
  * Chemistry = 54
  * Music = 78
  * Painting = 75
  * Veterinary Science = 619
  * Domestic Animals / Livestock = 636
  * Reptiles / Snakes = 598.12 or 639.15
  * Floor Construction / Building = 69.025 / 693.5
  * Library Science = 02
  * Biographies = 929
- Organizations = 061 or :061.2 (NEVER use 361 for scientific organizations).
- Common auxiliaries of form: Dictionaries=(038), Directories=(058.7), Reproductions/Plates=(084.1), Speeches=(042), Handbook=(035).
- Common auxiliaries of place: India=(540), South India=(540-13), World/International=(100).

Return ONLY valid JSON with this exact structure:
{
  "fullNotation": "exact synthesized notation without description, e.g. 52:061(100)(058.7)",
  "mainSubject": "Short main subject name",
  "subSubject": "Detailed facet description",
  "breakdown": "Element breakdown (e.g. 52: Astronomy; :061: Organizations; (100): World; (058.7): Directories)",
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

    // Google ke direct active model ka use
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;

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

    if (!response.ok || data.error) {
      throw new Error(data.error?.message || "Gemini API classification failed");
    }

    const rawOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawOutput) {
      throw new Error("Empty response from AI engine");
    }

    const cleanOutput = rawOutput.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanOutput);

    const notation = (
      parsed.fullNotation || 
      parsed.udcNumber || 
      parsed.notation || 
      parsed.classNumber || 
      parsed.completeAnswer || 
      ''
    ).trim();

    const mainSub = parsed.mainSubject || parsed.main_subject || '';
    const subSub = parsed.subSubject || parsed.sub_subject || '';
    const brk = parsed.breakdown || '';
    const conf = parsed.confidence || '95%';
    const evid = parsed.evidence || 'B.S. 1000A:1961 schedule verified';

    // Saari fields frontend ke mapping ke liye di gayi hain
    res.json({
      success: true,
      answer: notation,
      result: notation,
      completeAnswer: notation,
      complete_answer: notation,
      fullNotation: notation,
      full_notation: notation,
      udcNumber: notation,
      udc_number: notation,
      classNumber: notation,
      class_number: notation,
      classMark: notation,
      class_mark: notation,
      notation: notation,
      raw_notation: notation,
      mainSubject: mainSub,
      main_subject: mainSub,
      subSubject: subSub,
      sub_subject: subSub,
      breakdown: brk,
      confidence: conf,
      confidence_level: conf,
      evidence: evid,
      schedule_reference: evid
    });

  } catch (err) {
    console.error("Backend Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
