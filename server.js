import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();

// Built-in CORS handling (bina 'cors' package de)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

const PORT = process.env.PORT || 3000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

app.post('/api/classify', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: UDC_SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    });

    const result = await model.generateContent(`Synthesize full UDC notation for: "${title}"`);
    const parsedData = JSON.parse(result.response.text());

    res.json(parsedData);
  } catch (error) {
    console.error("UDC classification error:", error);
    res.status(500).json({ error: "Failed to generate UDC number", details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
