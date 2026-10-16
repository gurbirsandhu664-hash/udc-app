const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ਰੈਫਰੈਂਸ ਇੰਡੈਕਸ ਲੋਡਿੰਗ
let udcIndex = [];
let ddcIndex = [];

try {
  const udcPath = path.join(__dirname, 'udc-1961-reference-index.json');
  const ddcPath = path.join(__dirname, 'ddc-23-reference-index.json');
  if (fs.existsSync(udcPath)) udcIndex = JSON.parse(fs.readFileSync(udcPath, 'utf8'));
  if (fs.existsSync(ddcPath)) ddcIndex = JSON.parse(fs.readFileSync(ddcPath, 'utf8'));
} catch (e) {
  console.warn("Index reading warning:", e.message);
}

// Gemini API ਕਲਾਇੰਟ
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

function getClassificationPrompt(title, subject) {
  return `You are an expert library cataloger. Classify the following work under Dewey Decimal Classification (DDC) and Universal Decimal Classification (UDC).
Title: "${title}"
Subject/Context: "${subject || 'General'}"

Return ONLY a valid, raw JSON object (no markdown formatting, no backticks, no markdown code block) with this exact schema:
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
  "summary": "Brief explanation"
}`;
}

function cleanAndParseJSON(rawText) {
  if (!rawText) throw new Error("AI ਤੋਂ ਕੋਈ ਜਵਾਬ ਨਹੀਂ ਮਿਲਿਆ");
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

// ਹੈਲਥ ਚੈੱਕ ਰੂਟ (Render ਲਈ)
app.get('/health', (req, res) => {
  res.status(200).send("OK");
});

// ਮੁੱਖ ਵਰਗੀਕਰਣ API
app.post('/api/classify', async (req, res) => {
  const { title, subject } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: "ਕਿਰਪਾ ਕਰਕੇ ਕਿਤਾਬ ਦਾ ਨਾਮ ਦਰਜ ਕਰੋ।" });
  }

  if (!genAI) {
    return res.status(500).json({ 
      error: "GEMINI_API_KEY ਸਰਵਰ 'ਤੇ ਸੈੱਟ ਨਹੀਂ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ Render Environment ਵਿੱਚ ਸ਼ਾਮਲ ਕਰੋ।" 
    });
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });

    const result = await model.generateContent(getClassificationPrompt(title.trim(), subject || ""));
    const response = await result.response;
    const parsedData = cleanAndParseJSON(response.text());

    return res.json({
      success: true,
      provider: "Gemini 2.5 Flash",
      data: parsedData
    });
  } catch (error) {
    console.error("Gemini Classification Error:", error.message);
    return res.status(500).json({
      error: "ਵਰਗੀਕਰਨ ਕਰਨ ਦੌਰਾਨ ਸਮੱਸਿਆ ਆਈ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
      details: error.message
    });
  }
});

// ਹੋਮਪੇਜ ਰੂਟ
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ਪੋਰਟ ਲਿਸਨਰ
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server actively running on port ${PORT}`);
});
