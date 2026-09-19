const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 10000;
const ROOT = __dirname;

app.use(express.json({limit: "1mb"}));
app.use(express.static(ROOT));

function loadJson(filename) {
  try {
    const p = path.join(ROOT, filename);
    if (!fs.existsSync(p)) return [];
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.items)) return raw.items;
    if (Array.isArray(raw.titles)) return raw.titles;
    if (typeof raw === "object") {
      return Object.entries(raw).map(([title, value]) => {
        if (typeof value === "string") return {title, udc: value};
        return {title, ...value};
      });
    }
    return [];
  } catch (e) {
    console.error("Key load error:", filename, e.message);
    return [];
  }
}

let key = [
  ...loadJson("udc-2700-key.json"),
  ...loadJson("udc-2600-key.json")
];

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function localMatch(title) {
  const q = norm(title);
  if (!q) return null;

  let exact = key.find(x => norm(x.title || x.bookTitle || x.name) === q);
  if (exact) return {...exact, source: "Local UDC practice key", match: "exact"};

  // Whole-word / phrase scoring. Never fabricate a UDC number.
  const qt = new Set(q.split(" "));
  let best = null, bestScore = 0;
  for (const x of key) {
    const t = norm(x.title || x.bookTitle || x.name);
    if (!t) continue;
    const tt = new Set(t.split(" "));
    let common = 0;
    for (const w of qt) if (tt.has(w)) common++;
    const score = common / Math.max(qt.size, tt.size);
    if (score > bestScore) { bestScore = score; best = x; }
  }
  if (best && bestScore >= 0.82) return {...best, source: "Local UDC practice key", match: "high phrase match"};
  return null;
}

function googleConfigured() {
  return !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CX);
}

app.get("/api/status", (req,res) => {
  res.json({
    ok: true,
    version: "V17 Google UDC",
    localTitles: key.length,
    googleConfigured: googleConfigured(),
    googleNote: "Google search is a discovery/verification layer, not an authoritative UDC database."
  });
});

app.post("/api/classify", async (req,res) => {
  const title = String(req.body.title || "").trim();
  if (!title) return res.status(400).json({error:"Enter a book title."});

  const local = localMatch(title);
  if (local) return res.json({
    mode: "local",
    title,
    result: local,
    google: null
  });

  if (!googleConfigured()) {
    return res.json({
      mode: "google-not-configured",
      title,
      result: null,
      google: {
        configured: false,
        query: `${title} UDC Universal Decimal Classification`,
        directUrl: `https://www.google.com/search?q=${encodeURIComponent(title + " UDC Universal Decimal Classification")}`
      }
    });
  }

  try {
    const u = new URL("https://www.googleapis.com/customsearch/v1");
    u.searchParams.set("key", process.env.GOOGLE_API_KEY);
    u.searchParams.set("cx", process.env.GOOGLE_CX);
    u.searchParams.set("q", `${title} UDC Universal Decimal Classification`);
    u.searchParams.set("num", "10");
    u.searchParams.set("hl", "en");
    u.searchParams.set("gl", "in");

    const r = await fetch(u);
    const data = await r.json();
    if (!r.ok) {
      return res.json({
        mode: "google-error",
        title,
        result: null,
        google: {configured:true, error:data.error?.message || "Google search request failed."}
      });
    }

    const items = (data.items || []).map(x => ({
      title: x.title,
      link: x.link,
      displayLink: x.displayLink,
      snippet: x.snippet
    }));

    res.json({
      mode: "google",
      title,
      result: null,
      google: {
        configured: true,
        query: `${title} UDC Universal Decimal Classification`,
        items,
        warning: "Google results are not treated as an authoritative UDC classification. Verify the notation against an authorised UDC source."
      }
    });
  } catch (e) {
    res.json({
      mode: "google-error",
      title,
      result: null,
      google: {configured:true, error:e.message}
    });
  }
});

app.get("*", (req,res) => res.sendFile(path.join(ROOT, "index.html")));

app.listen(PORT, () => console.log(`UDC Ultimate V17 running on port ${PORT}`));
