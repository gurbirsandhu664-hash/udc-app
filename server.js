import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ਰੈਫਰੈਂਸ ਇੰਡੈਕਸ ਲੋਡਿੰਗ (ਜੇ ਉਪਲਬਧ ਹੋਵੇ)
let udcIndex = [];
let ddcIndex = [];

try {
  const udcPath = path.join(__dirname, 'udc-1961-reference-index.json');
  const ddcPath = path.join(__dirname, 'ddc-23-reference-index.json');
  if (fs.existsSync(udcPath)) udcIndex = JSON.parse(fs.readFileSync(udcPath, 'utf8'));
  if (fs.existsSync(ddcPath)) ddcIndex = JSON.parse(fs.readFileSync(ddcPath, 'utf8'));
} catch (e) {
  console.error("Reference files read error:", e.message);
}

// ਸਿਰਫ਼ Gemini API ਕਲਾਇੰਟ
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// ਕਲਾਸੀਫ਼ਿਕੇਸ਼ਨ ਪ੍ਰੋਂਪਟ
function getClassificationPrompt(title, subject) {
  return `You are an expert library cataloger. Classify the following work under Dewey Decimal Classification (DDC) and Universal Decimal Classification (UDC).
Title: "${title}"
Subject/Context: "${subject || 'General'}"

Return ONLY a valid, raw JSON object (no markdown, no backticks, no markdown code block) with this exact schema:
{
  "ddc": {
    "number": "string",
    "heading": "string",
    "confidence": "High/Medium/Low"
  },
  "udc": {
    "number": "string",
    "heading": "string",
    "confidence": "High/Medium/Low"
  },
  "summary": "Brief explanation of the classification"
}`;
}

// ਸੁਰੱਖਿਅਤ JSON ਕਲੀਨਰ
function cleanAndParseJSON(rawText) {
  if (!rawText) throw new Error("AI ਤੋਂ ਕੋਈ ਜਵਾਬ ਪ੍ਰਾਪਤ ਨਹੀਂ ਹੋਇਆ");
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

// ਮੁੱਖ ਵਰਗੀਕਰਣ ਰੂਟ
app.post('/api/classify', async (req, res) => {
  const { title, subject } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: "ਕਿਰਪਾ ਕਰਕੇ ਕਿਤਾਬ ਦਾ ਨਾਮ (Title) ਦਰਜ ਕਰੋ।" });
  }

  if (!ai) {
    return res.status(500).json({ error: "GEMINI_API_KEY ਸਰਵਰ 'ਤੇ ਸੈੱਟ ਨਹੀਂ ਹੈ।" });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: getClassificationPrompt(title.trim(), subject || ""),
      config: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });

    const parsedData = cleanAndParseJSON(response.text);

    return res.json({
      success: true,
      provider: "Gemini 2.5 Flash",
      data: parsedData
    });
  } catch (error) {
    console.error("Gemini 2.5 Flash Error:", error.message);
    return res.status(500).json({
      error: "ਜਵਾਬ ਤਿਆਰ ਕਰਨ ਵਿੱਚ ਸਮੱਸਿਆ ਆਈ ਹੈ, ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running smoothly on port ${PORT} using Gemini 2.5 Flash`);
});
