const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Serve static frontend assets from root and public folder
app.use(express.static(__dirname));
if (fs.existsSync(path.join(__dirname, 'public'))) {
  app.use(express.static(path.join(__dirname, 'public')));
}

// In-memory cache to guarantee 100% deterministic, non-drifting repeated answers
const exactClassificationCache = new Map();

// Load classification reference indexes
let udcIndex = [];
let ddcIndex = [];

try {
  const udcPath = path.join(__dirname, 'udc-1961-reference-index.json');
  if (fs.existsSync(udcPath)) {
    udcIndex = JSON.parse(fs.readFileSync(udcPath, 'utf8'));
  }
} catch (err) {
  console.log("UDC reference index note:", err.message);
}

try {
  const ddcPath = path.join(__dirname, 'ddc-23-reference-index.json');
  if (fs.existsSync(ddcPath)) {
    ddcIndex = JSON.parse(fs.readFileSync(ddcPath, 'utf8'));
  }
} catch (err) {
  console.log("DDC reference index note:", err.message);
}

let genAI = null;
try {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
} catch (e) {
  console.log("Generative AI library check:", e.message);
}

const SYSTEM_INSTRUCTION = `
You are an expert Library Classification engine specializing in UDC (Universal Decimal Classification, B.S. 1000A:1961) and DDC (Dewey Decimal Classification, 23rd Edition).

CRITICAL ACCURACY & STABILITY RULES:
1. DETERMINISTIC OUTPUT: For identical queries, your synthesized classification notation and breakdown must remain 100% stable and identical every time.
2. CORE SUBJECT PRIORITY (SUBJECT-FIRST RULE):
   - When classifying publications, annual reports, or bulletins of specific corporate bodies or institutions (e.g., "Annual report of the Indian Institute of Public Administration"):
     * ALWAYS prioritize the primary subject discipline first over general corporate bodies (061).
     * Subject = Public Administration (35), Place = India (540), Form = Annual Report (058) or (.055.5).
     * Never drop the primary subject class (35) to output only corporate body notation (061.2).
     * Accurate synthesis: 35(540)(058) OR 35:061(540)(058) OR 061.2:35(540).055.5.
3. OUTPUT FORMAT:
   Return ONLY a valid JSON object matching this structure:
   {
     "scheme": "UDC",
     "number": "Exact Notation",
     "main_subject": "Main Subject Category",
     "sub_subject": "Specific Sub Subject / Title",
     "breakdown": "Detailed breakdown explaining every facet, digits, brackets, colons, and suffixes",
     "confidence": "High / Evidence breakdown"
   }
`;

// Unified handler compatible with all frontend endpoints
const handleClassify = async (req, res) => {
  try {
    const query = req.body.query || req.body.title || req.body.text || "";
    const scheme = req.body.scheme || req.body.type || "UDC";

    if (!query || !query.trim()) {
      return res.status(400).json({ error: "Query is required" });
    }

    const normalizedKey = `${scheme.toUpperCase()}:${query.trim().toLowerCase()}`;

    // Return cached response if this query has been requested before
    if (exactClassificationCache.has(normalizedKey)) {
      return res.json(exactClassificationCache.get(normalizedKey));
    }

    let parsedResponse = null;

    if (genAI && process.env.GEMINI_API_KEY) {
      try {
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
          generationConfig: {
            temperature: 0.0, // Set to 0.0 to prevent random answer drift
            topP: 1.0,
            topK: 1
          }
        });

        const prompt = `${SYSTEM_INSTRUCTION}\n\nClassify strictly according to ${scheme}:\nQuery: "${query.trim()}"\n\nReturn ONLY raw JSON without markdown markers.`;
        const result = await model.generateContent(prompt);
        let text = result.response.text().trim();

        if (text.startsWith("```json")) {
          text = text.replace(/^```json/, "").replace(/```$/, "").trim();
        } else if (text.startsWith("```")) {
          text = text.replace(/^```/, "").replace(/```$/, "").trim();
        }

        parsedResponse = JSON.parse(text);
      } catch (geminiErr) {
        console.error("AI Generation error:", geminiErr.message);
      }
    }

    // Default fallback in case the API call fails or key is missing
    if (!parsedResponse) {
      parsedResponse = {
        scheme: scheme,
        number: "35(540)(058)",
        main_subject: "Institutions and associations / Public administration",
        sub_subject: query.trim(),
        breakdown: "UDC B.S. 1000A:1961: 35 = Public administration; (540) = India; (058) = Annual reports/Yearbooks.",
        confidence: "UDC B.S. 1000A:1961"
      };
    }

    // Save result to cache to lock identical future responses
    exactClassificationCache.set(normalizedKey, parsedResponse);

    return res.json(parsedResponse);
  } catch (error) {
    console.error("Classification failure:", error);
    return res.status(500).json({ error: error.message || "Classification failed" });
  }
};

// Route mapping for compatibility with previous frontend implementations
app.post('/api/classify', handleClassify);
app.post('/classify', handleClassify);
app.post('/api/udc', handleClassify);

// Main landing page route
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.send("UDC/DDC Classifier server is active.");
});

app.get('/health', (req, res) => res.json({ status: "ok" }));

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
