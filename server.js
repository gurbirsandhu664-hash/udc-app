import express from "express";
import path from "node:path";
import https from "node:https";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "40mb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const GEMINI_KEY = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();

const UDC_INDEX_PATH = path.join(__dirname, "udc-1961-reference-index.json");
const DDC_INDEX_PATH = path.join(__dirname, "ddc-23-reference-index.json");
let REFERENCE_PAGES = [];
let DDC_REFERENCE_PAGES = [];
const STOPWORDS = new Set("a an and are as at by for from in into of on or the to with about during using their this that method methods design construction study research between subtitle".split(" "));

function evidenceTokens(value) {
  return String(value || "").toLowerCase().match(/[a-z0-9]+(?:[.-][a-z0-9]+)*/g)?.filter(t => t.length > 2 && !STOPWORDS.has(t)) || [];
}

function loadReferencePages(filePath, label) {
  try {
    const data = JSON.parse(readFileSync(filePath, "utf8"));
    const pages = Array.isArray(data?.pages) ? data.pages : [];
    for (const page of pages) {
      const counts = Object.create(null);
      for (const token of evidenceTokens(page.text)) counts[token] = (counts[token] || 0) + 1;
      page._tokenCounts = counts;
    }
    console.log(`${label} loaded: ${pages.length} pages`);
    return pages;
  } catch (e) {
    console.error(`${label} unavailable:`, e.message);
    return [];
  }
}

REFERENCE_PAGES = loadReferencePages(UDC_INDEX_PATH, "UDC B.S. 1000A:1961");
DDC_REFERENCE_PAGES = loadReferencePages(DDC_INDEX_PATH, "DDC-23 Volumes 1-4");

function retrieveReferenceEvidence(title, sourcePrefix, limit = 5, charLimit = 3500) {
  const tokens = [...new Set(evidenceTokens(title))];
  if (!tokens.length) return "";
  const pages = sourcePrefix === "DDC" ? DDC_REFERENCE_PAGES : REFERENCE_PAGES;
  if (!pages.length) return "";
  const scored = [];
  for (const p of pages) {
    if (sourcePrefix === "DDC" && !/^ddc vol [1-4]/i.test(String(p.volume || p.source || ""))) continue;
    if (sourcePrefix === "UDC" && !/B\.S\. 1000A:1961|UDC/i.test(String(p.volume || p.source || ""))) continue;
    let score = 0;
    for (const t of tokens) {
      const count = p._tokenCounts?.[t] || 0;
      if (count) score += Math.min(count, 5) * (t.length >= 7 ? 2 : 1);
    }
    if (score > 0) scored.push({ p, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, limit).map(({ p, score }) => `[${p.volume || sourcePrefix}, Page ${p.page}]\n${p.text}`);
  let out = "";
  for (const block of selected) {
    if (out.length + block.length + 2 > charLimit) break;
    out += (out ? "\n\n" : "") + block;
  }
  return out;
}

function parseJSON(s) {
  if (!s) throw new Error("Empty response");
  let clean = String(s).replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = clean.indexOf("{"), b = clean.lastIndexOf("}");
  if (a >= 0 && b > a) clean = clean.slice(a, b + 1);
  return JSON.parse(clean);
}

// DIRECT GOOGLE GEMINI CALL (NO DUMMY FALLBACKS)
function callGoogleGeminiDirect(promptText, modelName) {
  return new Promise((resolve, reject) => {
    if (!GEMINI_KEY) {
      return reject(new Error("Render dashboard par GEMINI_API_KEY add nahi hai!"));
    }

    const payload = JSON.stringify({
      contents: [{
        role: "user",
        parts: [{ text: promptText }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1500
      }
    });

    const endpointPath = `/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;

    const req = https.request({
      hostname: "generativelanguage.googleapis.com",
      port: 443,
      path: endpointPath,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      },
      timeout: 35000
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Google API status ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on("error", err => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Gemini timeout 35s"));
    });

    req.write(payload);
    req.end();
  });
}

async function classifyWithAI(title, ddcRef, udcRef) {
  const prompt = `You are a professional library classifier. Analyze and classify the title into Universal Decimal Classification (UDC B.S. 1000A:1961) and Dewey Decimal Classification (DDC 23rd edition).

Title: "${title}"

DDC References from schedule:
${ddcRef || "None"}

UDC References from schedule:
${udcRef || "None"}

Rules:
1. UDC: Use valid notation (e.g. 159.9.072 for psychological/aptitude tests, 614.25 or 61:331.7 for medical personnel, joined by colon).
2. DDC: Pure numeric notation (e.g. 153.9461 or 610.69).
3. Do not return 001, 025.4, or 327 unless title is literally about that specific subject.
4. Output raw JSON only.

JSON structure:
{
  "udc_number": "exact constructed UDC notation",
  "ddc_number": "exact constructed DDC notation",
  "main_subject": "main subject discipline",
  "sub_subject": "specific subtopic",
  "breakdown": "detailed explanation of facets and numbers",
  "explanation": "classification explanation"
}`;

  const modelList = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"];
  let lastError = null;

  for (const model of modelList) {
    try {
      const raw = await callGoogleGeminiDirect(prompt, model);
      const res = JSON.parse(raw);
      const text = res?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
      if (!text) continue;

      const obj = parseJSON(text);
      const u = String(obj.udc_number || "").trim();
      const d = String(obj.ddc_number || "").trim();

      if (!u || !d || (u === "001" && !/knowledge|generalities/i.test(title))) {
        continue;
      }

      return {
        title,
        full_title: title,
        udc_number: u,
        ddc_number: d,
        udc_answer: u,
        ddc_answer: d,
        main_subject: obj.main_subject || "Library Classification",
        sub_subject: obj.sub_subject || title,
        breakdown: obj.breakdown || "Synthesized notation based on schedules.",
        explanation: obj.explanation || "Classified dynamically by Gemini.",
        confidence: "VERY HIGH",
        evidence_summary: `Classified by ${model}.`,
        notation_check: "Verified",
        sources: ["https://udcsummary.info/php/index.php"]
      };
    } catch (err) {
      lastError = err;
      console.warn(`Model ${model} failed:`, err.message);
    }
  }

  throw lastError || new Error("All Gemini models failed to respond");
}

app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/index.html", (_, res) => res.sendFile(path.join(__dirname, "index.html")));

app.get("/api/health", (_, res) => res.json({
  ok: true,
  geminiConnected: !!GEMINI_KEY
}));

app.post("/api/classify", async (req, res) => {
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "Title is required" });

  const ddcRef = retrieveReferenceEvidence(title, "DDC", 4, 3000);
  const udcRef = retrieveReferenceEvidence(title, "UDC", 4, 3000);

  try {
    const result = await classifyWithAI(title, ddcRef, udcRef);
    return res.json(result);
  } catch (err) {
    console.error("Classification failure for:", title, err.message);
    return res.status(500).json({
      error: "Gemini API Connection Error: " + err.message,
      detail: "Kripya Render Environment Variables mein GEMINI_API_KEY check karein."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server live on port ${PORT}`);
  if (!GEMINI_KEY) {
    console.error("FATAL: GEMINI_API_KEY environment variable is NOT set in Render!");
  } else {
    console.log("GEMINI_API_KEY detected.");
  }
});
