import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. ਸਥਿਰਤਾ (Consistency) ਲਈ Exact Query Cache
// ਤਾਂ ਜੋ ਇੱਕੋ ਸਵਾਲ ਦਾ ਉੱਤਰ ਦੂਜੀ ਵਾਰ ਬਦਲੇ ਬਿਨਾਂ ਬਿਲਕੁਲ ਉਹੀ ਆਵੇ
const exactClassificationCache = new Map();

// ਇੰਡੈਕਸ ਫਾਈਲਾਂ ਲੋਡ ਕਰੋ
let udcIndex = [];
let ddcIndex = [];

try {
  const udcPath = path.join(__dirname, 'udc-1961-reference-index.json');
  if (fs.existsSync(udcPath)) {
    udcIndex = JSON.parse(fs.readFileSync(udcPath, 'utf8'));
  }
} catch (err) {
  console.error("UDC index load error:", err.message);
}

try {
  const ddcPath = path.join(__dirname, 'ddc-23-reference-index.json');
  if (fs.existsSync(ddcPath)) {
    ddcIndex = JSON.parse(fs.readFileSync(ddcPath, 'utf8'));
  }
} catch (err) {
  console.error("DDC index load error:", err.message);
}

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// ਮਾਡਲ ਕੌਂਫਿਗਰੇਸ਼ਨ - Temperature ਬਿਲਕੁਲ 0.0 ਤਾਂ ਜੋ ਜਵਾਬ ਕਦੇ ਨਾ ਬਦਲੇ
const getModel = () => {
  if (!genAI) return null;
  return genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      temperature: 0.0,
      topP: 1.0,
      topK: 1
    }
  });
};

const SYSTEM_INSTRUCTION = `
You are an expert Library Classification engine specializing in UDC (Universal Decimal Classification, B.S. 1000A:1961) and DDC (Dewey Decimal Classification, 23rd Edition).

CRITICAL ACCURACY & STABILITY RULES:
1. DETERMINISM: For the exact same query, your synthesized notation and logic must remain 100% stable and reproducible.
2. CORE SUBJECT PRIORITY:
   - When classifying publications, annual reports, bulletins, or proceedings of specialized organizations/institutions:
     * ALWAYS prioritize the primary subject discipline first.
     * E.g., For "Annual report of the Indian Institute of Public Administration":
       The core subject is Public Administration (35), Place is India (540), and Form is Annual Report (058) or (.055.5).
       Do NOT reduce it purely to corporate bodies (061.2) without the subject 35.
       Correct notation: 35(540)(058) OR 35:061(540)(058) OR 061.2:35(540).055.5.
3. OUTPUT FORMAT:
   Always respond with valid JSON matching this schema:
   {
     "scheme": "UDC" | "DDC",
     "number": "Exact Notation",
     "main_subject": "Main Subject Category",
     "sub_subject": "Specific Title / Sub Subject",
     "breakdown": "Detailed breakdown explaining every facet, digits, brackets, colons",
     "confidence": "High / Medium"
   }
`;

app.post('/api/classify', async (req, res) => {
  try {
    const { query, scheme = 'UDC' } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: "Query is required" });
    }

    const normalizedKey = `${scheme.toUpperCase()}:${query.trim().toLowerCase()}`;

    // ਜੇ ਪਹਿਲਾਂ ਕੱਢਿਆ ਹੋਇਆ ਹੈ, ਤਾਂ ਹੂ-ਬ-ਹੂ ਉਹੀ ਉੱਤਰ ਵਾਪਸ ਭੇਜੋ
    if (exactClassificationCache.has(normalizedKey)) {
      return res.json(exactClassificationCache.get(normalizedKey));
    }

    const model = getModel();
    if (!model) {
      return res.status(500).json({ error: "Gemini API key is not configured" });
    }

    const prompt = `
${SYSTEM_INSTRUCTION}

Classify the following query strictly according to ${scheme}:
Query: "${query.trim()}"

Return ONLY valid JSON without Markdown blocks.
`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    if (text.startsWith("```json")) {
      text = text.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (text.startsWith("```")) {
      text = text.replace(/^```/, "").replace(/```$/, "").trim();
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(text);
    } catch (e) {
      parsedResponse = {
        scheme: scheme,
        number: "Check notation",
        main_subject: query,
        sub_subject: query,
        breakdown: text,
        confidence: "Medium"
      };
    }

    // ਕੈਸ਼ ਵਿੱਚ ਸੇਵ ਕਰੋ ਤਾਂ ਜੋ ਅਗਲੀ ਵਾਰ ਨਤੀਜਾ ਨਾ ਬਦਲੇ
    exactClassificationCache.set(normalizedKey, parsedResponse);

    return res.json(parsedResponse);
  } catch (error) {
    console.error("Classification error:", error);
    return res.status(500).json({ error: error.message || "Classification failed" });
  }
});

app.listen(port, () => {
  console.log(`Classification server running on port ${port}`);
});
