const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MODEL_CACHE_MS = 10 * 60 * 1000;
let modelCache = { at: 0, names: [] };

const CONFIG = {
  version: "30",
  appTitle: "UDC AI Classifier",
  reference: "B.S. 1000A:1961, Abridged English Edition, 3rd Edition Revised 1961",
  rule: "UDC only — never DDC"
};

let UDC_REFERENCE = "";
try {
  UDC_REFERENCE = fs.readFileSync(
    path.join(__dirname, "udc_reference.txt"),
    "utf8"
  );
} catch (e) {
  console.error("UDC reference file not found:", e.message);
}

let ANSWER_KEYS = {};
try {
  const keyData = JSON.parse(fs.readFileSync(path.join(__dirname, "answer_keys.json"), "utf8"));
  ANSWER_KEYS = keyData.keys || {};
  console.log("Loaded deterministic UDC answer keys:", Object.keys(ANSWER_KEYS).length);
} catch (e) {
  console.error("Answer key file not found/invalid:", e.message);
}

function normalizeTitleKey(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9+\/.:()\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function answerFromKey(title, key) {
  return `FINAL UDC NUMBER: ${key.udc}\nMAIN SUBJECT: ${key.subject}\nSHORT EXPLANATION: ${key.udc} is the fixed UDC answer for this exact title in the V30 answer-key layer.\nVERIFICATION: Answer-key match (${key.source}).`;
}

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9().:/+=\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "the","a","an","of","and","or","in","on","for","to","with","from",
  "by","about","study","studies","book","books","introduction","general"
]);

function referenceSnippets(question) {
  const words = [...new Set(
    normalize(question)
      .split(" ")
      .filter(w => w.length >= 3 && !STOP.has(w))
  )];

  if (!UDC_REFERENCE || words.length === 0) return "";

  const lines = UDC_REFERENCE.split(/\r?\n/);
  const scored = [];

  for (let i = 0; i < lines.length; i++) {
    const line = normalize(lines[i]);
    if (!line) continue;

    let score = 0;
    for (const word of words) {
      if (line.includes(word)) score += word.length >= 6 ? 3 : 1;
    }

    if (score > 0) {
      const start = Math.max(0, i - 2);
      const end = Math.min(lines.length, i + 3);
      scored.push({
        score,
        block: lines.slice(start, end).join("\n")
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const unique = [];
  const seen = new Set();

  for (const item of scored) {
    const key = item.block.trim();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(key);
    }
    if (unique.length >= 18) break;
  }

  return unique.join("\n\n");
}

function extractUDC(answer) {
  const text = String(answer || "");
  const m = text.match(/FINAL\s+UDC\s+NUMBER\s*[:\-]?\s*([^\n]+)/i);
  if (m) {
    const candidate = m[1].trim().match(/^[0-9.()=+\/:\-]+/);
    if (candidate) return candidate[0];
  }
  const fallback = text.match(/\b\d{1,3}(?:\.\d+)*(?:\([^)]*\))?(?:[+/:]\d{1,3}(?:\.\d+)*(?:\([^)]*\))?)*(?:\/\d{1,3}(?:\.\d+)*)?/);
  return fallback ? fallback[0] : "";
}

app.get("/", (req, res) => {
  res.send(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>UDC AI Classifier</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#f4f7fb;color:#172033}
.wrap{max-width:900px;margin:auto;padding:22px 16px 50px}
.header{background:#172033;color:#fff;padding:25px;border-radius:18px}
.badge{display:inline-block;background:#fff;color:#172033;padding:6px 10px;border-radius:20px;font-size:12px;font-weight:700}
h1{font-size:30px;margin:12px 0 7px}.sub{opacity:.9}
.card{background:#fff;margin-top:20px;padding:22px;border-radius:18px;box-shadow:0 5px 20px rgba(0,0,0,.08)}
label{display:block;font-weight:700;margin-bottom:9px}
textarea{width:100%;min-height:130px;padding:15px;border:1px solid #ccd3df;border-radius:12px;font-size:16px;resize:vertical}
button{width:100%;margin-top:14px;padding:15px;border:0;border-radius:12px;background:#172033;color:#fff;font-size:17px;font-weight:700}
button:disabled{opacity:.6}.loading{display:none;text-align:center;margin-top:15px}
.error{display:none;margin-top:15px;padding:12px;border-radius:10px;background:#fff0f2;color:#a00020}
.result{display:none;margin-top:24px}.row{padding:13px 0;border-bottom:1px solid #e5e8ee}
.udc{font-size:40px;font-weight:800;margin-top:8px}.answer{white-space:pre-wrap;line-height:1.55}
.note{font-size:13px;color:#687386;margin-top:16px}
</style>
</head>
<body>
<div class="wrap">
<div class="header">
<span class="badge">VERSION 30</span>
<h1>UDC AI Classifier</h1>
<div class="sub">B.S. 1000A:1961 Abridged UDC • Never DDC</div>
</div>
<div class="card">
<label for="q">Enter Book Title</label>
<textarea id="q" placeholder="Example: History of India"></textarea>
<button id="b" onclick="go()">CLASSIFY BOOK</button>
<div id="l" class="loading">Checking UDC reference and classifying...</div>
<div id="e" class="error"></div>
<div id="r" class="result">
<div class="row"><b>Book Title</b><div id="t"></div></div>
<div class="row"><b>FINAL UDC NUMBER</b><div id="u" class="udc"></div></div>
<div class="row"><b>AI Classification</b><div id="a" class="answer"></div></div>
</div>
<div class="note">Reference basis: the supplied B.S. 1000A:1961 Abridged English UDC. Exact notation should be verified against the licensed schedule when a title requires information not present in the supplied reference.</div>
</div>
</div>
<script>
async function go(){
 const q=document.getElementById("q").value.trim();
 const b=document.getElementById("b"),l=document.getElementById("l");
 const e=document.getElementById("e"),r=document.getElementById("r");
 if(!q){e.textContent="Please enter a book title.";e.style.display="block";return}
 e.style.display="none";r.style.display="none";l.style.display="block";b.disabled=true;
 try{
  const x=await fetch("/api/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:q})});
  const d=await x.json(); if(!x.ok) throw new Error(d.error||"Server error");
  document.getElementById("t").textContent=q;
  document.getElementById("a").textContent=d.answer||"No answer";
  document.getElementById("u").textContent=d.udc||"See AI classification";
  r.style.display="block";
 }catch(err){e.textContent=err.message;e.style.display="block"}
 finally{l.style.display="none";b.disabled=false}
}
</script>
</body>
</html>`);
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", version: CONFIG.version, referenceLoaded: !!UDC_REFERENCE, answerKeys: Object.keys(ANSWER_KEYS).length });
});

app.get("/api/config", (req, res) => res.json({ ...CONFIG, answerKeys: Object.keys(ANSWER_KEYS).length }));

app.post("/api/ask", async (req, res) => {
  try {
    const question = String(req.body?.question || "").trim();
    if (!question) return res.status(400).json({ error: "Question required" });

    // V30 deterministic answer-key layer runs BEFORE Gemini.
    // This prevents known titles from being reinterpreted by an LLM.
    const exactKey = ANSWER_KEYS[normalizeTitleKey(question)];
    if (exactKey) {
      const answer = answerFromKey(question, exactKey);
      return res.json({
        answer,
        udc: exactKey.udc,
        subject: exactKey.subject,
        source: "answer-key",
        version: CONFIG.version
      });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing in Render Environment Variables."
      });
    }

    const snippets = referenceSnippets(question);

    const prompt = `You are a specialist UDC classifier.

SOURCE OF AUTHORITY:
The supplied reference is "Universal Decimal Classification, B.S. 1000A:1961, Abridged English Edition, 3rd Edition Revised 1961". It is the classification basis for this application.

CLASSIFICATION RULES:
1. Use UDC only. NEVER output a DDC number.
2. Analyse the meaning of the title, not keywords alone.
3. Prefer the most specific UDC notation actually supported by the supplied reference.
4. Use common auxiliaries only when the reference supports them and they are appropriate.
5. For a place-specific subject, verify the place auxiliary in the reference before using it.
6. For a compound subject, use UDC relationship/compound notation only when the reference supports the construction.
7. Do not invent a number just because it looks plausible.
8. If the supplied reference does not establish an exact number, say "Exact notation not verified in supplied B.S. 1000A:1961 reference" and give the closest supported class, rather than pretending certainty.
9. Keep the answer concise.

BOOK TITLE:
${question}

RELEVANT EXTRACTS FROM THE SUPPLIED UDC REFERENCE:
${snippets || "(No direct extract found; use the general UDC principles in the source and clearly mark exact notation as unverified.)"}

RETURN EXACTLY:
FINAL UDC NUMBER: ...
MAIN SUBJECT: ...
SHORT EXPLANATION: ...
VERIFICATION: Verified in supplied reference / Exact notation not verified in supplied reference`;

    const body = {
      systemInstruction: {
        parts: [{
          text: "Follow the UDC classification rules exactly. Do not substitute DDC."
        }]
      },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 700
      }
    };

    // Build a live list of models available to THIS API key.
    // If the model list endpoint is temporarily unavailable, use a safe priority list.
    const fallbackPriority = [
      GEMINI_MODEL,
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-2.5-flash-lite"
    ];

    let available = [];
    try {
      available = await listGenerateContentModels();
    } catch (e) {
      console.warn("Could not list Gemini models; using fallback priority:", e.message);
    }

    const candidates = [...new Set(
      fallbackPriority.filter(Boolean).concat(available)
    )].filter(name => !available.length || available.includes(name));

    let lastError = "Gemini API error";
    let result = null;

    for (const model of candidates) {
      const attempt = await generateWithModel(model, body, 2);
      if (attempt?.response?.ok) {
        result = attempt;
        console.log("UDC classification model:", model);
        break;
      }

      const status = attempt?.response?.status || 500;
      const msg = attempt?.data?.error?.message || `HTTP ${status}`;
      lastError = msg;
      console.warn(`Gemini model ${model} failed (${status}): ${msg}`);

      // 400/401/402/403 are account/request problems; switching models
      // normally cannot fix them, so stop and show the real reason.
      if ([400, 401, 402, 403].includes(status)) break;
    }

    if (!result) {
      return res.status(503).json({
        error: "Gemini is temporarily busy or unavailable. The app automatically retried and checked available models. Please try again in a moment. Details: " + lastError
      });
    }

    const data = result.data;
    const answer =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No answer received.";

    res.json({
      answer,
      udc: extractUDC(answer),
      version: CONFIG.version
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
});

async function listGenerateContentModels() {
  const now = Date.now();
  if (modelCache.names.length && now - modelCache.at < MODEL_CACHE_MS) {
    return modelCache.names;
  }

  const url = "https://generativelanguage.googleapis.com/v1beta/models";
  const r = await fetch(url, { headers: { "x-goog-api-key": GEMINI_API_KEY } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `Model list failed (${r.status})`);

  const names = (d.models || [])
    .filter(m => Array.isArray(m.supportedGenerationMethods) &&
      m.supportedGenerationMethods.includes("generateContent"))
    .map(m => String(m.name || "").replace(/^models\//, ""))
    .filter(Boolean);

  modelCache = { at: now, names };
  return names;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(status) {
  return [408, 429, 500, 502, 503, 504].includes(status);
}

async function generateWithModel(model, body, maxRetries = 2) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) + ":generateContent";

  let last = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok) return { response, data };

    last = { response, data };
    if (!isRetryable(response.status) || attempt === maxRetries) break;

    const delay = Math.min(8000, 1200 * (2 ** attempt)) + Math.floor(Math.random() * 500);
    console.log(`Gemini ${model} returned ${response.status}; retrying in ${delay}ms`);
    await sleep(delay);
  }

  return last;
}

app.listen(PORT, () => {
  console.log("UDC AI V30 running on port " + PORT);
});
