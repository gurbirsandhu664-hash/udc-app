import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "64kb" }));
app.use(express.static(__dirname));

const port = Number(process.env.PORT || 10000);
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const groqModel = process.env.GROQ_MODEL || "groq/compound";
// Google grounding is best-effort. It must NEVER block a normal Gemini answer.
const useGoogleGrounding = /^(1|true|yes)$/i.test(process.env.GEMINI_GOOGLE_SEARCH || "true");

function keys(primary, plural) {
  return [...new Set(
    [process.env[plural] || "", process.env[primary] || ""]
      .flatMap(v => v.split(","))
      .map(v => v.trim())
      .filter(Boolean)
  )];
}
const geminiKeys = () => keys("GEMINI_API_KEY", "GEMINI_API_KEYS");
const groqKeys = () => keys("GROQ_API_KEY", "GROQ_API_KEYS");

// Avoid hammering a key after a 429. NOTE: Gemini quotas are normally per PROJECT,
// not per API key, so rotating keys from the same project cannot create more quota.
const geminiCooldown = new Map();
function isCooling(key) { return (geminiCooldown.get(key) || 0) > Date.now(); }
function cooldown(key, ms = 65000) { geminiCooldown.set(key, Date.now() + ms); }
function isQuotaError(e) {
  const s = `${e?.status || ""} ${e?.code || ""} ${e?.message || e || ""}`.toLowerCase();
  return /429|resource_exhausted|quota|rate.?limit|too many requests/.test(s);
}

function normalizeRecord(x, fallbackTitle = "") {
  if (!x || typeof x !== "object") return null;
  const title = String(x.title ?? x.bookTitle ?? x.name ?? fallbackTitle).trim();
  const udc = String(x.udc ?? x.number ?? x.classification ?? x.classificationNumber ?? "").trim();
  if (!title || !udc || udc === "0" || udc === "-") return null;
  return {
    title, udc,
    mainSubject: x.mainSubject ?? x.subject ?? x.main_subject ?? "",
    subSubject: x.subSubject ?? x.sub_subject ?? "",
    explanation: x.explanation ?? x.breakdown ?? x.notes ?? "",
    confidence: x.confidence ?? "High",
    verified: x.verified !== false
  };
}

function loadLocal() {
  const p = path.join(__dirname, "udc-2700-key.json");
  if (!fs.existsSync(p)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    let arr = Array.isArray(raw) ? raw : (raw.records || raw.entries || []);
    if (!Array.isArray(arr) && raw && typeof raw === "object") {
      arr = Object.entries(raw).map(([k, v]) => typeof v === "object" ? { ...v, title: v.title || k } : { title: k, udc: v });
    }
    return arr.map(x => normalizeRecord(x)).filter(Boolean);
  } catch (e) {
    console.error("UDC key load error:", e.message);
    return [];
  }
}
const local = loadLocal();

function norm(s) { return String(s || "").toLowerCase().replace(/[“”"'`]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
function tokens(s) { return new Set(norm(s).split(/\s+/).filter(w => w.length > 2)); }

function localMatch(title) {
  const q = norm(title);
  if (!q) return null;
  const exact = local.find(x => norm(x.title) === q);
  if (exact) return exact;
  return local.find(x => {
    const t = norm(x.title);
    return t && (q.includes(t) || t.includes(q));
  }) || null;
}

// Give Gemini a small, relevant slice of the 2700-title key instead of sending the
// whole database. This improves accuracy while keeping token usage low.
function candidateRecords(title, limit = 14) {
  const q = tokens(title);
  return local
    .map(r => {
      const t = tokens(r.title);
      let score = 0;
      for (const w of q) if (t.has(w)) score += 3;
      if (norm(r.title) === norm(title)) score += 100;
      return { r, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.r);
}

const SYSTEM = `
You are the primary UDC book-classification engine.
STRICT RULE: Universal Decimal Classification (UDC) ONLY. NEVER use Dewey Decimal Classification (DDC).

Goal: classify the user's BOOK TITLE as accurately as possible using the supplied UDC key candidates and your UDC knowledge.
1. Understand the complete title/meaning; do not classify from one keyword alone.
2. Prefer the most specific defensible UDC notation.
3. Use UDC auxiliaries only when justified: place, language, form, time, viewpoint, common auxiliaries and special auxiliaries.
4. For literature, distinguish language, literature and literary form.
5. Never invent a UDC number merely to fill a field.
6. If a supplied key record directly matches the title/meaning, prefer its UDC notation.
7. If no direct key record exists, give your best UDC classification only when you can defend the notation from established UDC structure.
8. Never output 0, -, null, or a made-up placeholder as a UDC number.
9. Return ONLY valid JSON.

JSON:
{
  "verified": true|false,
  "udc": "string or empty",
  "title": "string",
  "mainSubject": "string",
  "subSubject": "string",
  "explanation": "brief notation/subject explanation",
  "confidence": "High|Medium|Low|Not verified",
  "verificationLabel": "Gemini UDC analysis",
  "evidence": "brief reason",
  "sources": []
}

Important: 'verified' means the number is supported by a local UDC key record or reliable UDC reasoning. Do not claim Google verification unless Google grounding actually supplied evidence.
`;

function extractJSON(text) {
  const s = String(text || "").trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(s); } catch {}
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch {} }
  return null;
}

function groundingSources(resp) {
  const out = [];
  const chunks = resp?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  for (const c of chunks) {
    const w = c?.web;
    if (w?.uri) out.push({ title: w.title || w.uri, url: w.uri });
  }
  return [...new Map(out.map(x => [x.url, x])).values()].slice(0, 8);
}

async function geminiRequest(key, title, grounding) {
  const ai = new GoogleGenAI({ apiKey: key });
  const candidates = candidateRecords(title);
  const keyContext = candidates.length
    ? `\nLOCAL UDC KEY CANDIDATES (use as authoritative hints; do not alter their notation):\n${JSON.stringify(candidates)}`
    : "\nNo close local-key candidate was found.";
  const prompt = `${SYSTEM}\nTITLE: ${title}${keyContext}\nReturn the classification JSON once.`;
  const config = { temperature: 0.1 };
  if (grounding) config.tools = [{ googleSearch: {} }];
  const resp = await ai.models.generateContent({ model: geminiModel, contents: prompt, config });
  const parsed = extractJSON(resp.text);
  if (!parsed) throw new Error("Gemini returned invalid JSON");
  const sources = groundingSources(resp);
  if (grounding && parsed.verified && parsed.udc && sources.length) {
    parsed.sources = sources;
    parsed.verificationLabel = "Gemini + Google Search verification";
  } else {
    parsed.sources = sources;
  }
  return parsed;
}

async function geminiAttempt(key, title) {
  // First try normal Gemini: this is the reliable path when Search Grounding quota is exhausted.
  // Then optionally try Google grounding only if the normal answer was not verified.
  const plain = await geminiRequest(key, title, false);
  if (plain?.verified && plain?.udc) return plain;
  if (useGoogleGrounding) {
    try {
      const grounded = await geminiRequest(key, title, true);
      if (grounded?.verified && grounded?.udc) return grounded;
      return grounded || plain;
    } catch (e) {
      // Grounding quota/network failure must never erase a usable Gemini result.
      if (!isQuotaError(e)) console.error("Gemini Google grounding:", e.message);
      return plain;
    }
  }
  return plain;
}

async function groqAttempt(key, title) {
  const groq = new Groq({ apiKey: key });
  const candidates = candidateRecords(title);
  const prompt = `${SYSTEM}\nTITLE: ${title}\nLOCAL KEY CANDIDATES: ${JSON.stringify(candidates)}\nReturn JSON only. Do not invent a number.`;
  const r = await groq.chat.completions.create({
    model: groqModel,
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
    temperature: 0.1
  });
  const parsed = extractJSON(r?.choices?.[0]?.message?.content);
  if (!parsed) throw new Error("Groq returned invalid JSON");
  parsed.sources = Array.isArray(parsed.sources) ? parsed.sources : [];
  parsed.verificationLabel = parsed.verified ? "Groq UDC fallback" : "Not verified";
  return parsed;
}

function cleanResult(r, title) {
  if (!r || !r.verified || !r.udc || r.udc === "0" || r.udc === "-") {
    return { verified: false, title, message: r?.explanation || "No reliable UDC classification was verified.", sources: r?.sources || [] };
  }
  return {
    verified: true,
    title: r.title || title,
    udc: String(r.udc).trim(),
    mainSubject: r.mainSubject || "",
    subSubject: r.subSubject || "",
    explanation: r.explanation || "",
    confidence: r.confidence || "Medium",
    verificationLabel: r.verificationLabel || "Verified",
    evidence: r.evidence || "",
    sources: Array.isArray(r.sources) ? r.sources : []
  };
}

app.get("/api/health", (req, res) => res.json({
  ok: true,
  version: "V22",
  localKeyRecords: local.length,
  geminiKeys: geminiKeys().length,
  groqKeys: groqKeys().length,
  googleGroundingBestEffort: useGoogleGrounding
}));

app.post("/api/classify", async (req, res) => {
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ verified: false, message: "Enter a book title." });

  // Exact local key is always first: no API quota is consumed.
  const hit = localMatch(title);
  if (hit) return res.json({ ...cleanResult(hit, title), providerStatus: "LOCAL UDC KEY VERIFIED" });

  let last = [];
  let hadGeminiQuota = false;

  // Gemini PRIMARY. 429/quota is swallowed and immediately falls through to Groq.
  for (const key of geminiKeys()) {
    if (isCooling(key)) continue;
    try {
      const r = await geminiAttempt(key, title);
      if (r?.verified && r?.udc) {
        return res.json({ ...cleanResult(r, title), providerStatus: r.verificationLabel || "Gemini PRIMARY" });
      }
      last.push(r);
    } catch (e) {
      if (isQuotaError(e)) { cooldown(key); hadGeminiQuota = true; }
      else console.error("Gemini:", e.message);
      last.push({ verified: false, explanation: "Gemini request unavailable" });
    }
  }

  // Groq FALLBACK. No Gemini error is shown to the user.
  for (const key of groqKeys()) {
    try {
      const r = await groqAttempt(key, title);
      if (r?.verified && r?.udc) {
        return res.json({ ...cleanResult(r, title), providerStatus: "Groq FALLBACK" });
      }
      last.push(r);
    } catch (e) {
      console.error("Groq:", e.message);
      last.push({ verified: false, explanation: "Fallback unavailable" });
    }
  }

  return res.json({
    verified: false,
    title,
    message: "No reliable UDC classification was verified. The app did not invent a UDC number.",
    providerStatus: hadGeminiQuota ? "NOT VERIFIED — API QUOTA TEMPORARILY UNAVAILABLE" : "NOT VERIFIED",
    diagnostics: process.env.NODE_ENV === "development" ? last : undefined
  });
});

app.use((req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(port, () => console.log(`UDC Ultimate V22 running on port ${port}`));
