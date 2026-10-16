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

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

function getClassificationPrompt(title) {
  return `You are an expert library cataloger. Classify the following work under Dewey Decimal Classification (DDC) and Universal Decimal Classification (UDC).
Title: "${title}"

Return ONLY a valid, raw JSON object (no markdown, no backticks, no comments) with this exact schema:
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

app.get('/health', (req, res) => {
  res.status(200).send("OK");
});

app.post('/api/classify', async (req, res) => {
  const { title } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: "ਕਿਰਪਾ ਕਰਕੇ ਕਿਤਾਬ ਦਾ ਨਾਮ ਦਰਜ ਕਰੋ।" });
  }

  if (!genAI || !process.env.GEMINI_API_KEY) {
    return res.status(500).json({ 
      error: "GEMINI_API_KEY ਮਿਲੀ ਨਹੀਂ। Render ਦੇ Environment Variables ਵਿੱਚ GEMINI_API_KEY ਸ਼ਾਮਲ ਕਰੋ।" 
    });
  }

  // ਮਾਡਲ ਲਿਸਟ: ਪਹਿਲਾਂ gemini-3.8-flash, ਜੇਕਰ ਕੋਈ ਸਮੱਸਿਆ ਆਵੇ ਤਾਂ gemini-2.5-flash / gemini-1.5-flash
  const modelsToTry = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
  let lastError = null;
  let parsedData = null;
  let usedModel = '';

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      });

      const result = await model.generateContent(getClassificationPrompt(title.trim()));
      const response = await result.response;
      parsedData = cleanAndParseJSON(response.text());
      usedModel = modelName;
      break; // ਜੇਕਰ ਕਾਲ ਸਫ਼ਲ ਹੋ ਜਾਵੇ ਤਾਂ ਲੂਪ ਰੋਕੋ
    } catch (err) {
      console.warn(`Model ${modelName} failed, trying next... Error:`, err.message);
      lastError = err;
    }
  }

  if (parsedData) {
    return res.json({
      success: true,
      provider: usedModel,
      data: parsedData
    });
  } else {
    return res.status(500).json({
      error: "ਵਰਗੀਕਰਨ ਕਰਨ ਦੌਰਾਨ ਸਮੱਸਿਆ ਆਈ ਹੈ: " + (lastError ? lastError.message : "ਅਣਜਾਣ ਗਲਤੀ"),
      details: lastError ? lastError.message : null
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server actively running on port ${PORT}`);
});
