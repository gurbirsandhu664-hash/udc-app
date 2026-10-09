import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Inbuilt CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Static Files Serve
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const UDC_SYSTEM_PROMPT = `You are an expert Universal Decimal Classification (UDC - BS 1000A / Standard Edition) engine.
Your task is to accurately synthesize the full UDC class mark for any given document title without truncation or hallucination.

CRITICAL MAPPING & CITATION ORDER RULES:
1. CORE MAIN DISCIPLINES:
   - Identify the exact field of study:
     * Astronomy & Astrophysics: 52 (Do NOT confuse with Physics 53)
     * Physics: 53
     * Chemistry: 54
     * Mathematics: 51
     * Biological Sciences: 57
     * Zoology / Animals: 59
     * Librarianship / Library Science: 02
     * Biography / Genealogy: 929
     * Technology / Applied Sciences / Agriculture: 6

2. ORGANIZATIONS / ASSOCIATIONS:
   - Use 061 (or 061.2 for non-governmental / professional associations).
   - Link to the main subject via relation sign ':'.
   - NEVER use Class 36 / 361 (Social welfare/relief) for professional bodies or scientific organizations.

3. COMMON AUXILIARIES:
   - Form Auxiliaries (0...):
     * Directory / Address List: (058.7)
     * Handbook / Manual: (035)
     * Speeches / Addresses: (042)
     * Dictionaries / Encyclopedias: (03)
     * Serials / Periodicals: (05)
   - Place Auxiliaries (...):
     * International / World: (100)
     * India: (540)
     * South India: (540-13)

4. SYNTAX & FACET ORDER:
   - Standard structure: [Main Subject] : [Secondary Subject or Organization] (Place) (Form)
   - Example 1: "World Directory of Astronomical Organisations" -> 52:061(100)(058.7)
   - Example 2: "Indian Library Association" -> 02:061.2(540)
   - Example 3: "Famous scientists of India (speeches on their life and research)" -> 929:5(540)(042)

OUTPUT REQUIREMENT:
Respond ONLY with a JSON object adhering to this schema:
{
  "fullNotation": "Synthesized UDC number here",
  "mainSubject": "Short description of main subject",
  "subSubject": "Refined breakdown of title facets",
  "breakdown": "Element-by-element UDC breakdown",
  "confidence": "HIGH"
}`;

// Root URL Route (index.html dhoond ke serve karega)
app.get('/', (req, res) => {
  const rootIndex = path.join(__dirname, 'index.html');
  const publicIndex = path.join(__dirname, 'public', 'index.html');

  if (fs.existsSync(rootIndex)) {
    return res.sendFile(rootIndex);
  } else if (fs.existsSync(publicIndex)) {
    return res.sendFile(publicIndex);
  } else {
    res.send("<h1>Server Active!</h1><p>index.html upload karo ya API check karo (/api/classify).</p>");
  }
});

// API endpoint
app.post('/api/classify', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY missing on Render" });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: UDC_SYSTEM_PROMPT }]
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: `Synthesize full UDC notation for: "${title}"` }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        })
      }
    );

    const apiData = await response.json();

    if (!response.ok) {
      throw new Error(apiData.error?.message || 'Gemini API call failed');
    }

    const rawText = apiData.candidates?.[0]?.content?.parts?.[0]?.text;
    const cleanJson = JSON.parse(rawText);

    res.json(cleanJson);
  } catch (error) {
    console.error("Server Error:", error.message);
    res.status(500).json({ error: "Failed to classify title", details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
