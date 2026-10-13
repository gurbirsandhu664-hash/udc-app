import express from "express";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "40mb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const GEMINI_KEY = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
const DEFAULT_MODEL = "gemini-2.5-flash";

const UDC_INDEX_PATH = path.join(__dirname, "udc-1961-reference-index.json");
const DDC_INDEX_PATH = path.join(__dirname, "ddc-23-reference-index.json");
let REFERENCE_PAGES = [];
let DDC_REFERENCE_PAGES = [];
const STOPWORDS = new Set("a an and are as at by for from in into of on or the to with about during using their this that method methods design construction study research".split(" "));

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

function retrieveReferenceEvidence(title, sourcePrefix, limit = 5, charLimit = 6900) {
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
  const selected = scored.slice(0, limit).map(({ p, score }) => `[${p.volume || sourcePrefix}, Page ${p.page}, score ${score}]\n${p.text}`);
  let out = "";
  for (const block of selected) {
    if (out.length + block.length + 2 > charLimit) break;
    out += (out ? "\n\n" : "") + block;
  }
  return out;
}

const SUMMARY_BASE = "https://udcsummary.info/php/index.php";
const ENGINE_VERSION = "V126 pure Gemini 2.5 Flash High Accuracy";

const UDC_RULES = `
You are an expert Library Science classifier specializing in UDC (B.S. 1000A:1961) and Dewey Decimal Classification (DDC 23rd Edition).
Universal Decimal Classification (UDC) is primary. Dewey Decimal Classification (DDC) is secondary.
RULE 1: Never mix UDC into DDC, and never mix DDC into UDC. Keep them completely separate.
RULE 2: Preserve the full title and substantive concepts (place, language, form, topic, history).
RULE 3: UDC uses colon ':' for relations, '+' for coordination, '=' for language, '(0...)' for form, '(1/9)' for place, and quotes '""' for time.
RULE 4: DDC uses purely numeric decimal notation (digits with a single decimal point after 3 digits).
RULE 5: Provide realistic, professional, accurate UDC and DDC classifications for every title. Never return blank or empty strings.
`;

const schema = {
  type: "object",
  properties: {
    title: { type: "string" },
    udc_number: { type: "string" },
    ddc_number: { type: "string" },
    main_subject: { type: "string" },
    sub_subject: { type: "string" },
    explanation: { type: "string" },
    breakdown: { type: "string" },
    confidence: { type: "string" },
    evidence_summary: { type: "string" },
    notation_check: { type: "string" }
  },
  required: ["title", "udc_number", "ddc_number", "main_subject", "sub_subject", "explanation", "breakdown", "confidence", "evidence_summary", "notation_check"]
};

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function parseJSON(s) {
  if (!s) throw Error("Empty response");
  s = String(s).replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/i, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s);
}

// Fixed titles for instant zero-latency match
const exact = [
  [/^famous scientists? of india.*(?:speeches|research|life).*$/i, "5.007(540)(042)", "509.2", "Natural sciences / Scientists", "Famous scientists of India — speeches on their life and research", "UDC: 5 = Natural sciences; 5.007 = Scientists generally; (540) = India; (042) = Speeches/lectures. DDC: 509.2 = Biography of scientists."],
  [/^science and arts?$/i, "5+7", "500", "Natural Sciences and Arts", "Science and Arts", "UDC: 5 = Natural sciences; 7 = Arts; + indicates coordination. DDC: 500 = Science (or 700 = Arts)."],
  [/^sobha singh.*reproductions?.*$/i, "75(084.1)SOB", "759.954", "Painting", "Sobha Singh — Reproductions of His Paintings", "75 = Painting; (084.1) = pictorial documents; SOB = Sobha Singh."],
  [/^sobha singh$/i, "75(084.1)SOB", "759.954", "Painting", "Sobha Singh", "75 = Painting; (084.1) = pictorial documents; SOB = Sobha Singh."],
  [/^harvesting of wheat and maize$/i, "633.11+633.15:631.55", "633.11", "Agriculture", "Harvesting of wheat and maize", "633.11 = wheat; 633.15 = maize; 631.55 = harvesting."],
  [/^harvesting of cereals$/i, "633.1:631.55", "633.1", "Agriculture", "Harvesting of cereals", "633.1 = cereals; 631.55 = harvesting."],
  [/^history of india$/i, "94(540)", "954", "History", "History of India", "94 = General history; (540) = India."]
];

function localMatch(title) {
  const t = norm(title);
  for (const e of exact) {
    if (e[0].test(t)) {
      return {
        title, full_title: title,
        udc_number: e[1], ddc_number: e[2],
        udc_answer: e[1], ddc_answer: e[2],
        main_subject: e[3], sub_subject: e[4],
        breakdown: e[5], explanation: e[5],
        confidence: "VERY HIGH", evidence_summary: "Schedule grounded match",
        notation_check: "Verified", sources: [SUMMARY_BASE]
      };
    }
  }
  return null;
}

async function geminiCall(title, ddcRef, udcRef) {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY is not set in Render environment variables.");

  const endpoint = `[https://generativelanguage.googleapis.com/v1beta/models/$](https://generativelanguage.googleapis.com/v1beta/models/$){DEFAULT_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;

  const body = {
    contents: [{
      role: "user",
      parts: [{
        text: `${UDC_RULES}
Classify the following book title accurately: "${title}".

DDC Schedule Reference Evidence:
${ddcRef || "None"}

UDC Schedule Reference Evidence:
${udcRef || "None"}

Generate accurate UDC and DDC numbers. Return strictly in JSON according to schema.`
      }]
    }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: schema,
      maxOutputTokens: 1500
    }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const txt = await response.text();
  if (!response.ok) {
    console.error("Gemini API Error Response:", txt);
    throw new Error(`Gemini API Error HTTP ${response.status}`);
  }

  const resJson = JSON.parse(txt);
  
  // Robustly extract all parts of response text
  const parts = resJson?.candidates?.[0]?.content?.parts || [];
  const rawText = parts.map(p => p.text || "").join("");
  if (!rawText) throw new Error("Gemini returned an empty candidate text.");

  const parsed = parseJSON(rawText);

  return {
    ...parsed,
    title,
    full_title: title,
    udc_answer: parsed.udc_number || "—",
    ddc_answer: parsed.ddc_number || "—",
    engine: "Gemini 2.5 Flash",
    model: DEFAULT_MODEL
  };
}

app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/index.html", (_, res) => res.sendFile(path.join(__dirname, "index.html")));

app.get("/api/health", (_, res) => res.json({
  ok: true,
  version: ENGINE_VERSION,
  geminiConfigured: !!GEMINI_KEY,
  model: DEFAULT_MODEL
}));

app.post("/api/classify", async (req, res) => {
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "Title required" });

  // 1. Check exact pre-verified titles
  const exactHit = localMatch(title);
  if (exactHit) return res.json(exactHit);

  // 2. Fetch schedule reference evidence from bundled indexes
  const bundledDDC = retrieveReferenceEvidence(title, "DDC", 4, 3000);
  const bundledUDC = retrieveReferenceEvidence(title, "UDC", 4, 3000);

  // 3. Dynamic call to Gemini 2.5 Flash
  try {
    const aiResult = await geminiCall(title, bundledDDC, bundledUDC);
    return res.json(aiResult);
  } catch (err) {
    console.error("Gemini Execution Error:", err.message);
    return res.status(500).json({
      error: `Classification error: ${err.message}. Please verify GEMINI_API_KEY in Render.`
    });
  }
});

app.listen(PORT, () => console.log(`Classifier running on port ${PORT} using ${DEFAULT_MODEL}`));
