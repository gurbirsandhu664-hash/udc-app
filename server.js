const express = require("express");
const path = require("path");
const fs = require("fs");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Load Local Database Fallback
let localDatabase = [];
try {
  const seedData = fs.readFileSync(path.join(__dirname, "seed-udc.json"), "utf8");
  localDatabase = JSON.parse(seedData);
} catch (err) {
  console.log("Local database file not loaded, continuing with API only.");
}

// DeepSeek API Configuration
const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY || "dummy-key",
});

// Classification Logic with DeepSeek
async function classifyWithDeepSeek(title) {
  const prompt = `You are an expert Universal Decimal Classification (UDC) classifier.
Classify the given book or subject title according to official UDC standards.
Return strictly a valid JSON object matching this schema:
{
  "udc": "string (valid UDC notation)",
  "description": "string (class description)",
  "evidence": "string (short reasoning)"
}

Title: "${title}"`;

  const response = await openai.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: "You output only clean JSON without markdown codeblocks." },
      { role: "user", content: prompt }
    ],
    temperature: 0.1,
  });

  const rawText = response.choices[0].message.content.trim();
  const cleanJson = rawText.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
  return JSON.parse(cleanJson);
}

// Search and Classify Route
app.post("/api/classify", async (req, res) => {
  const { title } = req.body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Title is required." });
  }

  const cleanTitle = title.trim();

  // 1. Try DeepSeek if API Key is present
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const apiResult = await classifyWithDeepSeek(cleanTitle);

      // Relaxed validation: check for valid string output without strict regex crash
      if (apiResult && apiResult.udc && typeof apiResult.udc === "string") {
        return res.json({
          success: true,
          title: cleanTitle,
          udc: apiResult.udc.trim(),
          description: apiResult.description || "Classified via DeepSeek",
          evidence: apiResult.evidence || "UDC Standard"
        });
      }
    } catch (err) {
      console.error("DeepSeek API request failed:", err.message);
    }
  }

  // 2. Fallback to Local Data Matching if API fails or Key not configured
  const normalizedQuery = cleanTitle.toLowerCase();
  const match = localDatabase.find((item) =>
    (item.title && item.title.toLowerCase().includes(normalizedQuery)) ||
    (item.description && item.description.toLowerCase().includes(normalizedQuery))
  );

  if (match) {
    return res.json({
      success: true,
      title: cleanTitle,
      udc: match.udc,
      description: match.description,
      evidence: "Matched from local classification index"
    });
  }

  // Safe fallback without pattern error
  return res.json({
    success: true,
    title: cleanTitle,
    udc: "Unassigned / General",
    description: "Classification pending verification",
    evidence: "Please verify key configuration or retry."
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

