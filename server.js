const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const API_KEY = process.env.GEMINI_API_KEY;

function getPrompt(title) {
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
  if (!rawText) throw new Error("Empty response received from AI");
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

// Function to fetch available models for your specific API key
async function findWorkingModel(apiKey) {
  try {
    const res = await fetch(`[https://generativelanguage.googleapis.com/v1beta/models?key=$](https://generativelanguage.googleapis.com/v1beta/models?key=$){apiKey}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.models && Array.isArray(data.models)) {
      const available = data.models
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name.replace('models/', ''));

      // Prefer gemini-3.8-flash, then any flash model
      const preferred = available.find(m => m === 'gemini-3.8-flash') ||
                        available.find(m => m.includes('3.8')) ||
                        available.find(m => m.includes('flash')) ||
                        available[0];
      return preferred || null;
    }
  } catch (err) {
    console.warn("Could not list models dynamically:", err.message);
  }
  return null;
}

app.get('/health', (req, res) => {
  res.status(200).send("OK");
});

app.post('/api/classify', async (req, res) => {
  const { title } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: "Please enter a valid book title." });
  }

  if (!API_KEY) {
    return res.status(500).json({ 
      error: "GEMINI_API_KEY is missing. Please add it to your Render Environment Variables." 
    });
  }

  // Determine candidate models in order of priority
  const candidates = ['gemini-3.8-flash'];
  const dynamicModel = await findWorkingModel(API_KEY);
  if (dynamicModel && !candidates.includes(dynamicModel)) {
    candidates.push(dynamicModel);
  }

  let finalData = null;
  let modelUsed = '';
  let lastError = null;

  for (const model of candidates) {
    try {
      const url = `[https://generativelanguage.googleapis.com/v1beta/models/$](https://generativelanguage.googleapis.com/v1beta/models/$){model}:generateContent?key=${API_KEY}`;
      const payload = {
        contents: [
          {
            parts: [{ text: getPrompt(title.trim()) }]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const jsonResponse = await response.json();

      if (!response.ok) {
        throw new Error(jsonResponse.error?.message || `HTTP ${response.status}`);
      }

      const rawText = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      finalData = cleanAndParseJSON(rawText);
      modelUsed = model;
      break;
    } catch (err) {
      console.warn(`Attempt with ${model} failed: ${err.message}`);
      lastError = err;
    }
  }

  if (finalData) {
    return res.json({
      success: true,
      provider: modelUsed,
      data: finalData
    });
  }

  return res.status(500).json({
    error: "Classification failed: " + (lastError ? lastError.message : "Unknown error")
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server actively running on port ${PORT}`);
});
