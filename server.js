import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const GROQ_MODEL = process.env.GROQ_MODEL || "groq/compound";

let starter = [];
try {
  starter = JSON.parse(fs.readFileSync(path.join(__dirname, "seed-udc.json"), "utf8"));
} catch (_) {
  starter = [];
}

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    model: GEMINI_MODEL
  });
});

function compactStarter() {
  return starter.slice(0, 50).map(x => ({
    title: x.title, udc: x.udc, subject: x.subject, breakdown: x.breakdown
  }));
}

function cleanJson(text) {
  if (!text) return null;
  const fenced = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(fenced); } catch (_) {}
  const m = fenced.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (_) { return null; }
}

function normalizeResult(obj, title) {
  const r = obj && typeof obj === "object" ? obj : {};
  return {
    bookTitle: r.bookTitle || title,
    finalUdcNumber: r.finalUdcNumber || r.udc || "",
    mainSubject: r.mainSubject || "",
    subSubject: r.subSubject || "",
    shortExplanation: r.shortExplanation || "",
    breakdown: r.breakdown || "",
    confidence: r.confidence || "Unverified",
    verificationStatus: r.verificationStatus || "UNVERIFIED",
    sources: Array.isArray(r.sources) ? r.sources.slice(0, 8) : [],
    searchedQueries: Array.isArray(r.searchedQueries) ? r.searchedQueries.slice(0, 8) : []
  };
}

async function geminiClassify(title, groqResearch = "") {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_KEY_MISSING");
  }

  const system = `
You are the FINAL UDC classifier for the Universal Decimal Classification (UDC).
This application is UDC ONLY. NEVER use DDC.

Goal: classify the user's book title as accurately as possible using the UDC Abridged Edition / UDC terminology.
You have Google Search grounding enabled. Search before deciding when the title is not an exact local match.

Rules:
1. Understand the whole title, not isolated keywords.
2. Prefer a verified UDC number over an invented number.
3. Use UDC auxiliaries only when supported: place, language, form, time, point of view, etc.
4. Handle literature, language, dictionaries, encyclopedias, handbooks/manuals, religion, science, technology, education, social sciences, history and geography.
5. For literary works, distinguish literature/language and literary form where the evidence supports it.
6. Search the web for exact UDC evidence. Prefer official UDC Consortium material where publicly available; otherwise use reputable library/catalogue/reference evidence and say so.
7. Do not treat DDC numbers as UDC numbers.
8. If sources disagree, do not silently merge them. Prefer the source that explicitly describes UDC notation and explain the conflict.
9. Do not output 0 as a fallback.
10. If a defensible UDC number cannot be verified, leave finalUdcNumber empty and set verificationStatus to UNVERIFIED.
11. Return ONLY valid JSON, no markdown.

JSON fields:
bookTitle, finalUdcNumber, mainSubject, subSubject, shortExplanation, breakdown,
confidence, verificationStatus, sources (array of {title,url}), searchedQueries (array of strings).
`;

  const user = `
Book title: ${title}

Local starter records (only as hints; verify them):
${JSON.stringify(compactStarter())}

Optional Groq research notes (research only, never authoritative):
${groqResearch.slice(0, 6000)}
`;

  const body = {
    contents: [{ role: "user", parts: [{ text: system + "\n" + user }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1800,
      responseMimeType: "application/json"
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const raw = await resp.text();
    let data = null;
    try { data = JSON.parse(raw); } catch (_) {}

    if (!resp.ok) {
      const msg = data?.error?.message || `Gemini HTTP ${resp.status}`;
      throw new Error(msg);
    }

    const text = data?.candidates?.[0]?.content?.parts
      ?.map(p => p.text || "").join("") || "";

    const parsed = cleanJson(text);
    if (!parsed) throw new Error("GEMINI_INVALID_JSON");

    // Add Google grounding sources if the model omitted its own source list.
    const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const grounded = chunks
      .map(c => c.web)
      .filter(Boolean)
      .map(w => ({ title: w.title || "Web source", url: w.uri }))
      .filter(x => x.url);

    const result = normalizeResult(parsed, title);
    if (!result.sources.length && grounded.length) result.sources = grounded.slice(0, 8);
    if (!result.searchedQueries.length) {
      result.searchedQueries = data?.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];
    }
    result.verificationStatus = result.finalUdcNumber ? (result.verificationStatus || "VERIFIED_BY_GEMINI") : "UNVERIFIED";
    return result;
  } finally {
    clearTimeout(timer);
  }
}

async function groqResearch(title) {
  if (!process.env.GROQ_API_KEY) return "";
  const body = {
    model: GROQ_MODEL,
    messages: [
      {
        role: "system",
        content: "You are research-only support for a UDC classifier. Do not invent UDC numbers. If you know a relevant UDC reference, state it cautiously and include the reason. Never claim to be the final authority."
      },
      { role: "user", content: `Research this book title for UDC classification: ${title}` }
    ],
    temperature: 0.1,
    max_completion_tokens: 900
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!resp.ok) return "";
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content || "";
  } catch (_) {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

app.post("/api/classify", async (req, res) => {
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ ok: false, error: "TITLE_REQUIRED" });

  try {
    // Groq is deliberately non-critical and never becomes the final answer.
    const research = await groqResearch(title);
    const result = await geminiClassify(title, research);
    res.json({ ok: true, engine: "Gemini", researchUsed: Boolean(research), result });
  } catch (err) {
    const message = String(err?.message || "CLASSIFICATION_FAILED");
    let code = "CLASSIFICATION_FAILED";
    if (message === "GEMINI_KEY_MISSING") code = "GEMINI_KEY_MISSING";
    if (message === "GEMINI_INVALID_JSON") code = "GEMINI_INVALID_JSON";
    res.status(200).json({
      ok: false,
      error: code,
      message: "Gemini could not produce a verified final UDC result. No guessed number was returned."
    });
  }
});

app.use((req, res) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) {
    return res.sendFile(path.join(__dirname, "index.html"));
  }
  res.status(404).json({ ok: false, error: "NOT_FOUND" });
});

app.listen(PORT, () => {
  console.log(`UDC One-Click V36 running on port ${PORT}`);
});
