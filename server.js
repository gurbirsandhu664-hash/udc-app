const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const API_KEY = (process.env.GEMINI_API_KEY || '').trim();

function getPrompt(title) {
  return "You are an expert library cataloger. Classify the following work under Dewey Decimal Classification (DDC) and Universal Decimal Classification (UDC).\n" +
    "Title: \"" + title + "\"\n\n" +
    "Return ONLY a valid, raw JSON object (no markdown, no backticks, no comments) with this exact schema:\n" +
    "{\n" +
    "  \"ddc\": {\n" +
    "    \"number\": \"string\",\n" +
    "    \"heading\": \"string\",\n" +
    "    \"confidence\": \"High/Medium/Low\"\n" +
    "  },\n" +
    "  \"udc\": {\n" +
    "    \"number\": \"string\",\n" +
    "    \"heading\": \"string\",\n" +
    "    \"confidence\": \"High/Medium/Low\"\n" +
    "  },\n" +
    "  \"summary\": \"Brief explanation\"\n" +
    "}";
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

app.get('/health', (req, res) => {
  res.status(200).send("OK");
});

app.post('/api/classify', async (req, res) => {
  const { title } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: "Please enter a book title." });
  }

  if (!API_KEY) {
    return res.status(500).json({ 
      error: "GEMINI_API_KEY is not configured in Render Environment Variables." 
    });
  }

  const modelList = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
  let finalData = null;
  let activeModel = '';
  let lastErrMsg = '';

  for (let i = 0; i < modelList.length; i++) {
    const currentModel = modelList[i];
    try {
      const endpoint = "[https://generativelanguage.googleapis.com/v1beta/models/](https://generativelanguage.googleapis.com/v1beta/models/)" + 
        encodeURIComponent(currentModel) + 
        ":generateContent?key=" + 
        encodeURIComponent(API_KEY);

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

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resJson = await response.json();

      if (!response.ok) {
        throw new Error(resJson.error?.message || ("HTTP " + response.status));
      }

      const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      finalData = cleanAndParseJSON(rawText);
      activeModel = currentModel;
      break;
    } catch (err) {
      console.warn("Attempt with " + currentModel + " failed: " + err.message);
      lastErrMsg = err.message;
    }
  }

  if (finalData) {
    return res.json({
      success: true,
      provider: activeModel,
      data: finalData
    });
  }

  return res.status(500).json({
    error: "Classification failed: " + lastErrMsg
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log("Server actively running on port " + PORT);
});
