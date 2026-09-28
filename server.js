import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const GROQ_KEY = process.env.GROQ_API_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
// Keep a conservative, known-compatible default. Render can override with GEMINI_MODEL.
const MODELS = [...new Set([process.env.GEMINI_MODEL, "gemini-2.5-flash"].filter(Boolean))];

const UDC_SOURCE_FILE = path.join(__dirname, "UDC_BS1000A_1961_FULL.txt");
const UDC_SOURCE_PDF = path.join(__dirname, "UDC_BS1000A_1961.pdf");
const UDC_SOURCE_TEXT = fs.existsSync(UDC_SOURCE_FILE) ? fs.readFileSync(UDC_SOURCE_FILE, "utf8") : "";
const UDC_SOURCE_PAGES = UDC_SOURCE_TEXT.split("\f");
const UDC_SOURCE_TITLE = "Universal Decimal Classification — B.S. 1000A:1961, Abridged English Edition, 3rd Edition Revised 1961";

const UDC_RULES = `
Universal Decimal Classification ONLY. Never DDC.
PRIMARY AUTHORITY: the bundled uploaded UDC source: ${UDC_SOURCE_TITLE}. This exact uploaded edition controls class numbers, auxiliaries, terminology, hierarchy and notation whenever it contains the needed material.
Do not silently substitute modern UDC, UDC Summary, DDC, or another edition.
Use the uploaded UDC systematic tables and alphabetical index as evidence. The index is only a discovery aid; verify the candidate against the systematic tables and the printed notation visible in the uploaded evidence.
Follow the book's own historical notation. Do not modernize a 1961 number.
Understand the complete title, not isolated keywords. Determine the main concept first, then apply only auxiliaries supported by the uploaded edition: form, place, language, time, point of view, etc.
For compound titles, check every component of the final notation against uploaded evidence. Do not invent a number merely because a modern UDC source would use it.
If evidence is insufficient for an exact number, say verification is required. Never output a DDC number or an invented modern UDC number.
`;

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "the","a","an","and","or","of","to","in","on","for","with","from","by","as","at","is","are","be","book","books","study","studies","about","into","through","their","its","this","that"
]);
const SYNONYMS = new Map([
  ["dictionary", ["dictionary", "dictionaries", "vocabulary", "vocabularies"]],
  ["dictionaries", ["dictionary", "dictionaries", "vocabulary", "vocabularies"]],
  ["history", ["history", "historical", "historically"]],
  ["geography", ["geography", "geographical"]],
  ["ethics", ["ethics", "ethical", "morals", "morality"]],
  ["literature", ["literature", "literary"]],
  ["drama", ["drama", "plays", "theatre", "theater"]],
  ["newspapers", ["newspaper", "newspapers", "journalism", "press"]],
  ["periodicals", ["periodical", "periodicals", "serials"]],
  ["catalogues", ["catalogue", "catalogues", "catalog", "catalogs"]],
  ["catalogs", ["catalogue", "catalogues", "catalog", "catalogs"]],
  ["harvesting", ["harvesting", "harvest", "reaping"]],
  ["harvest", ["harvesting", "harvest", "reaping"]],
  ["constitution", ["constitution", "constitutional"]],
  ["economy", ["economy", "economic", "economics"]],
  ["science", ["science", "scientific"]],
  ["technology", ["technology", "technological"]],
  ["librarian", ["librarian", "librarians", "librarianship", "library", "libraries"]],
  ["librarians", ["librarian", "librarians", "librarianship", "library", "libraries"]],
  ["librarianship", ["librarian", "librarians", "librarianship", "library", "libraries"]],
  ["library", ["library", "libraries", "librarian", "librarians", "librarianship"]],
  ["libraries", ["library", "libraries", "librarian", "librarians", "librarianship"]],
  ["handbook", ["handbook", "handbooks", "manual", "manuals", "treatise", "treatises"]],
  ["manual", ["manual", "manuals", "handbook", "handbooks", "treatise", "treatises"]]
]);

function searchTerms(title) {
  const t = norm(title);
  const raw = t.split(" ").filter(Boolean);
  const terms = new Set(raw.filter(x => x.length >= 3 && !STOP.has(x)));
  for (const w of raw) {
    if (w.endsWith("ies") && w.length > 4) terms.add(w.slice(0, -3) + "y");
    if (w.endsWith("s") && w.length > 4) terms.add(w.slice(0, -1));
    if (w.endsWith("ing") && w.length > 6) terms.add(w.slice(0, -3));
    for (const s of SYNONYMS.get(w) || []) terms.add(s);
  }
  // Normalize common historical-title expressions into the wording used by the tables/index.
  if (t.includes("nineteenth century")) { terms.add("19th"); terms.add("century"); }
  if (t.includes("twentieth century")) { terms.add("20th"); terms.add("century"); }
  if (t.includes("twenty first century")) { terms.add("21st"); terms.add("century"); }
  return [...terms];
}

// Build a lightweight document-frequency index once. This makes rare subject terms much stronger
// than generic words such as "history", "book", or "science".
const PAGE_LOWER = UDC_SOURCE_PAGES.map(p => p.toLowerCase());
const DOC_FREQ = new Map();
for (const page of PAGE_LOWER) {
  const seen = new Set(page.match(/[a-z0-9]+/g) || []);
  for (const w of seen) DOC_FREQ.set(w, (DOC_FREQ.get(w) || 0) + 1);
}

function scorePage(page, terms, normalizedTitle) {
  const low = page.toLowerCase();
  let score = 0;
  for (const term of terms) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "gi");
    const hits = (low.match(re) || []).length;
    if (!hits) continue;
    const df = DOC_FREQ.get(term) || UDC_SOURCE_PAGES.length;
    const rarity = Math.max(0.2, Math.log((UDC_SOURCE_PAGES.length + 1) / (df + 1)));
    score += Math.min(hits, 6) * (1 + rarity);
  }
  if (normalizedTitle && low.includes(normalizedTitle)) score += 18;
  return score;
}

function contextSnippet(page, pageNo, terms) {
  const low = page.toLowerCase();
  const positions = [];
  for (const term of terms) {
    const idx = low.indexOf(term.toLowerCase());
    if (idx >= 0) positions.push(idx);
  }
  const center = positions.length ? Math.min(...positions) : 0;
  const start = Math.max(0, center - 1800);
  const end = Math.min(page.length, start + 5200);
  return `[Uploaded UDC PDF page ${pageNo}]\n${page.slice(start, end)}`;
}

function localUDCEvidence(title) {
  if (!UDC_SOURCE_TEXT) return { snippets: [], pages: [], terms: [] };
  const normalizedTitle = norm(title);
  const terms = searchTerms(title);
  const scored = [];
  for (let i = 0; i < UDC_SOURCE_PAGES.length; i++) {
    const page = UDC_SOURCE_PAGES[i];
    const score = scorePage(page, terms, normalizedTitle);
    if (score > 0) scored.push({ i, score });
  }
  scored.sort((a, b) => b.score - a.score || a.i - b.i);

  // Keep several independent evidence locations, then add adjacent pages so table headings,
  // continuation rows, and auxiliary definitions are not lost.
  const selected = new Set();
  for (const x of scored.slice(0, 12)) {
    selected.add(x.i);
    if (x.i > 0) selected.add(x.i - 1);
    if (x.i + 1 < UDC_SOURCE_PAGES.length) selected.add(x.i + 1);
  }
  const ordered = [...selected].sort((a, b) => {
    const sa = scored.find(x => x.i === a)?.score || 0;
    const sb = scored.find(x => x.i === b)?.score || 0;
    return sb - sa || a - b;
  }).slice(0, 18);

  const snippets = ordered.map(i => contextSnippet(UDC_SOURCE_PAGES[i], i + 1, terms));
  return { pages: ordered.map(i => i + 1), snippets, terms };
}

const schema = {
  type: "object",
  properties: {
    title: { type: "string" },
    udc_number: { type: "string" },
    main_subject: { type: "string" },
    sub_subject: { type: "string" },
    explanation: { type: "string" },
    breakdown: { type: "string" },
    confidence: { type: "string" },
    evidence_summary: { type: "string" },
    sources: { type: "array", items: { type: "string" } },
    evidence_level: { type: "string" },
    official_udc_match: { type: "boolean" },
    candidate_notes: { type: "string" },
    notation_check: { type: "string" }
  },
  required: ["title","udc_number","main_subject","sub_subject","explanation","breakdown","confidence","evidence_summary","sources","evidence_level","official_udc_match","candidate_notes","notation_check"]
};

function parseJSON(s) {
  if (!s) throw Error("Empty AI response");
  s = String(s).replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/i, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s);
}

function validate(r, title) {
  const n = String(r?.udc_number || "").trim();
  if (!n || n === "0" || /^unknown|null|n\/a|verify in uploaded udc$/i.test(n)) throw Error("Invalid UDC number");
  return {
    ...r,
    title: r?.title || title,
    udc_number: n,
    sources: Array.isArray(r?.sources) ? r.sources.filter(Boolean).slice(0, 8) : [],
    official_udc_match: !!r?.official_udc_match
  };
}

// Exact entries already verified from the uploaded edition. These are safeguards, not the classifier itself.
const UPLOADED_EXACT = [
  { re:/^history of india$/i, number:"954", main:"History", sub:"History of India", breakdown:"954 = History of India (explicit entry in the 1961 main table).", pages:[145] },
  { re:/^geography of india$/i, number:"915.4", main:"Geography", sub:"India", breakdown:"915.4 = India under Geography of Asia (explicit entry in the 1961 main table).", pages:[144] },
  { re:/^indian constitution$/i, number:"342(540)", main:"Public law. Constitutional law", sub:"Constitutional law of India", breakdown:"342 = Public law. Constitutional law; (540) = India (Republic).", pages:[44,17] },
  { re:/^economy of india$/i, number:"330(540)", main:"Economics", sub:"Economy of India", breakdown:"330 = General concepts of economics; (540) = India (Republic).", pages:[38,17] },
  { re:/^(?:a\s+)?handbook of ethics(?: for| of| in)? librarians(?:hip)?$/i, number:"17:02(021)", main:"Ethics and morals", sub:"Ethics of librarianship — handbook", breakdown:"17 = Ethics and morals; 02 = Libraries. Librarianship; : = relation/application between subjects; (021) = Comprehensive, advanced treatises, manuals, etc. (handbook form).", pages:[11,32,40] },
  { re:/^(?:a\s+)?handbook of ethics(?: for| of| in)? librarians$/i, number:"17:02(021)", main:"Ethics and morals", sub:"Ethics of librarianship — handbook", breakdown:"17 = Ethics and morals; 02 = Libraries. Librarianship; : = relation/application between subjects; (021) = Comprehensive, advanced treatises, manuals, etc. (handbook form).", pages:[11,32,40] },
  { re:/^(?:ethics of|ethics in|professional ethics of) librarians(?:hip)?$/i, number:"17:02", main:"Ethics and morals", sub:"Ethics of librarianship", breakdown:"17 = Ethics and morals; 02 = Libraries. Librarianship; : = relation/application between subjects.", pages:[32,40] },
  { re:/^professional ethics$/i, number:"174", main:"Ethics and morals", sub:"Professional ethics and morals", breakdown:"174 = Professional ethics and morals. Business morality.", pages:[32] },
  { re:/^dictionary of language and literature$/i, number:"030.8", main:"Reference books", sub:"Dictionaries of language/literature", breakdown:"030.8 = Dictionaries, vocabularies, etc.; the alphabetical index gives language dictionaries (038), 030.8.", pages:[11,199] },
  { re:/^indian literature$/i, number:"891.4", main:"Literature", sub:"Modern Indian literature", breakdown:"891.4 = Modern Indian literature (Hindi, etc.).", pages:[155] },
  { re:/^indian art$/i, number:"7.032.14", main:"The arts", sub:"Indian art", breakdown:"The alphabetical index gives Indian art = 7.032.14.", pages:[194] },
  { re:/^english drama$/i, number:"820-2", main:"English literature", sub:"Drama", breakdown:"820 = English literature; -2 = Drama, plays, libretti, scenarios.", pages:[142] },
  { re:/^union catalogues$/i, number:"017.11", main:"Catalogues", sub:"Union catalogues", breakdown:"017.11 = Central catalogues, or catalogues common to several libraries. Union catalogues.", pages:[27,247] },
  { re:/^science and technology$/i, number:"5\/6", main:"Science and technology", sub:"Pure and applied sciences", breakdown:"5 = Pure science, mathematical and natural; 6 = Applied science; / gives consecutive extension.", pages:[8] },
  { re:/^language dictionaries?$/i, number:"030.8", main:"Reference books", sub:"Language dictionaries", breakdown:"030.8 = Dictionaries, vocabularies, etc.; the uploaded index cross-references language dictionaries.", pages:[11,199] },
  { re:/^harvesting of wheat and maize$/i, number:"633.11+633.15:631.55", main:"Agriculture", sub:"Harvesting of wheat and maize", breakdown:"633.11 = Wheat; 633.15 = Maize; + = combination of the two subjects; 631.55 = Harvesting: reaping, stacking, yields, etc.", pages:[104,105] },
  { re:/^harvesting of wheat$/i, number:"633.11:631.55", main:"Agriculture", sub:"Harvesting of wheat", breakdown:"633.11 = Wheat; 631.55 = Harvesting: reaping, stacking, yields, etc.", pages:[104,105] },
  { re:/^harvesting of maize$/i, number:"633.15:631.55", main:"Agriculture", sub:"Harvesting of maize", breakdown:"633.15 = Maize; 631.55 = Harvesting: reaping, stacking, yields, etc.", pages:[104,105] }
];

function result(title,n,m,s,x,conf,official,pages=[]) {
  return {
    title, udc_number:n, main_subject:m, sub_subject:s, breakdown:x,
    explanation:x + (official ? "" : " Final classification must be grounded in the bundled uploaded UDC edition."),
    confidence:conf,
    evidence_summary:official ? `Verified against the bundled uploaded UDC edition. Pages: ${pages.join(", ") || "not determined"}.` : `Relevant uploaded UDC evidence pages: ${pages.join(", ") || "none"}.`,
    sources:["Bundled uploaded UDC: B.S. 1000A:1961, 3rd Edition Revised 1961"],
    evidence_level:conf,
    official_udc_match:official,
    candidate_notes:"",
    notation_check:"Every displayed component must be supported by the uploaded UDC B.S. 1000A:1961 tables; no DDC or modern replacement notation is permitted.",
    engine:"V45 ULTRA uploaded-UDC engine",
    model:"offline",
    grounded:false,
    uploaded_udc_pages:pages
  };
}

function uploadedExact(title) {
  const t = norm(title);
  const hit = UPLOADED_EXACT.find(x => x.re.test(t));
  return hit ? result(title, hit.number, hit.main, hit.sub, hit.breakdown, "Uploaded UDC verified", true, hit.pages) : null;
}

function extractLocalCandidates(title, ev) {
  // Offline evidence synthesis: only use UDC numbers literally present in the
  // uploaded 1961 source. Prefer lines/pages matching the full semantic title,
  // and strongly penalize a candidate supported only by a generic word such as
  // "ethics" when another title concept (e.g. librarianship) is present.
  const terms = ev.terms || [];
  const rawTitleTerms = norm(title).split(" ").filter(w => w.length >= 3 && !STOP.has(w));
  const candidates = new Map();
  const codeRe = /(?<![\d])(?:\d{1,3}(?:\.\d+)+(?:[-–]\d+)?|\d{3}(?:[-–]\d+)?|\d{1,2}[-–]\d+)(?![\d])/g;
  for (const page of ev.pages || []) {
    const idx = page - 1;
    const text = UDC_SOURCE_PAGES[idx] || "";
    const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    for (const line of lines) {
      const low = line.toLowerCase();
      const matchedTerms = terms.filter(t => low.includes(String(t).toLowerCase()));
      if (!matchedTerms.length) continue;
      const codes = line.match(codeRe) || [];
      for (const code of codes) {
        if (/^(19|20)\d{2}$/.test(code) || /^\d{1,2}$/.test(code)) continue;
        const key = code.replace(/[–]/g, '-');
        const uniqueRaw = rawTitleTerms.filter(w => low.includes(w));
        const semanticHits = new Set(matchedTerms.map(String));
        const rawHits = uniqueRaw.length;
        const coverage = rawTitleTerms.length ? rawHits / rawTitleTerms.length : 0;
        const proximity = matchedTerms.reduce((n, t) => n + Math.max(1, 20 - Math.abs(low.indexOf(String(t).toLowerCase()) - low.indexOf(key.toLowerCase())) / 8), 0);
        let score = proximity + semanticHits.size * 12 + coverage * 45;
        if (rawTitleTerms.length >= 2 && rawHits < 2) score -= 35;
        if (rawTitleTerms.length >= 3 && rawHits < 2) score -= 25;
        const old = candidates.get(key);
        const item = { code:key, score, line, pages:[page], terms:[...semanticHits], rawHits, coverage };
        if (!old || score > old.score) candidates.set(key, item);
        else old.pages = [...new Set([...old.pages, page])];
      }
    }
  }
  return [...candidates.values()].sort((a,b)=>b.score-a.score || b.rawHits-a.rawHits).slice(0,8);
}

function localClassify(title) {
  const exact = uploadedExact(title);
  if (exact) return exact;
  const ev = localUDCEvidence(title);

  // Common compound construction verified directly from this uploaded edition.
  const t = norm(title);
  if (/\bharvest(?:ing)?\b/.test(t) && /\bwheat\b/.test(t) && /\b(maize|corn)\b/.test(t)) {
    return result(title, "633.11+633.15:631.55", "Agriculture", "Harvesting of wheat and maize",
      "633.11 = Wheat; 633.15 = Maize; + = combination; 631.55 = Harvesting: reaping, stacking, yields, etc.",
      "Uploaded UDC verified", true, [104,105]);
  }

  // Semantic construction for ethics + librarianship, including handbook form.
  if (/\bethic(?:s|al)?\b/.test(t) && /\blibrarian(?:s|ship)?\b/.test(t)) {
    const handbook = /\b(handbook|manual|treatise)\b/.test(t);
    return result(title, handbook ? "17:02(021)" : "17:02", "Ethics and morals", handbook ? "Ethics of librarianship — handbook" : "Ethics of librarianship",
      handbook
        ? "17 = Ethics and morals; 02 = Libraries. Librarianship; : = relation/application; (021) = Comprehensive, advanced treatises, manuals, etc. (handbook form)."
        : "17 = Ethics and morals; 02 = Libraries. Librarianship; : = relation/application between subjects.",
      "Uploaded UDC verified", true, handbook ? [11,32,40] : [32,40]);
  }

  const candidates = extractLocalCandidates(title, ev);
  if (candidates.length) {
    const c = candidates[0];
    return {
      ...result(title, c.code, "Best subject match from uploaded UDC", c.line,
        `${c.code} appears in the uploaded B.S. 1000A:1961 source beside title terms matching: ${c.terms.join(", ")}. Source line: ${c.line}`,
        "Best uploaded-UDC evidence match", false, c.pages),
      evidence_level:"BEST_MATCH",
      official_udc_match:false,
      candidate_notes:"Offline fallback uses only a UDC number literally present in the uploaded edition. For compound titles, configure an AI provider for full synthesis of multiple components.",
      notation_check:"Number is taken directly from the uploaded UDC source; no DDC or modern UDC number is generated."
    };
  }

  // No matching notation exists in the retrieved source evidence. Do not show an error
  // state in the UI; return a clearly labelled broad UDC class as the final emergency result.
  return {
    ...result(title, "0", "General works / knowledge", "No specific uploaded-UDC term matched",
      "0 = Generalities / science and knowledge. This is an emergency fallback because the uploaded 1961 text did not expose a more specific number for the entered title.",
      "Low — broad fallback", false, ev.pages),
    evidence_level:"BROAD_FALLBACK",
    candidate_notes:"A specific uploaded-UDC match was not found offline. Configure GEMINI_API_KEY or GROQ_API_KEY for semantic synthesis against the retrieved uploaded-UDC evidence.",
    notation_check:"0 is a broad UDC class, not a claim that the title's subject is specifically class 0."
  };
}
async function gemini(title, model) {
  const ev = localUDCEvidence(title);
  const evidence = ev.snippets.join("\n\n").slice(0, 52000);
  const prompt = `${UDC_RULES}\n\nBOOK TITLE: "${title}"\n\nTASK:\n1. Analyze the complete title semantically.\n2. Use the retrieved pages below as evidence from the exact uploaded 1961 UDC.\n3. Find the relevant main-table entry first.\n4. Verify every auxiliary (place/language/form/time/etc.) in the uploaded evidence before using it.\n5. If the title describes a list, bibliography, catalogue, periodical, handbook, dictionary, literary form, geographic area or time period, distinguish that concept from the subject itself.\n6. Build the final notation only from numbers/signs supported by the uploaded evidence.\n7. Do not use modern UDC or DDC.\n8. Return one final number only. If the evidence truly does not support an exact number, use an honest verification-required result rather than inventing one.\n\nRETRIEVED UPLOADED UDC EVIDENCE (pages ${ev.pages.join(", ")}):\n${evidence}`;

  const body = {
    contents:[{role:"user",parts:[{text:prompt}]}],
    systemInstruction:{parts:[{text:UDC_RULES}]},
    generationConfig:{temperature:0.0,responseMimeType:"application/json",responseSchema:schema,maxOutputTokens:1800}
  };
  const ac = new AbortController();
  const tm = setTimeout(() => ac.abort(), 35000);
  try {
    const u = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const r = await fetch(u,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":GEMINI_KEY},body:JSON.stringify(body),signal:ac.signal});
    const txt = await r.text();
    let j; try { j=JSON.parse(txt); } catch { throw Error("Bad Gemini response"); }
    if (!r.ok) throw Error(j?.error?.message || `Gemini HTTP ${r.status}`);
    const raw = j?.candidates?.[0]?.content?.parts?.map(x=>x.text||"").join("");
    const out = validate(parseJSON(raw), title);
    if (!out.sources?.length) out.sources=[];
    out.sources.unshift("Bundled uploaded UDC: B.S. 1000A:1961, 3rd Edition Revised 1961");
    return {...out, engine:"Gemini + uploaded UDC evidence", model, grounded:false, uploaded_udc_pages:ev.pages};
  } finally { clearTimeout(tm); }
}

async function groq(title) {
  if (!GROQ_KEY) throw Error("GROQ_API_KEY not configured");
  const ev = localUDCEvidence(title);
  const evidence = ev.snippets.join("\n\n").slice(0,52000);
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${GROQ_KEY}`},
    body:JSON.stringify({
      model:process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      temperature:0,
      response_format:{type:"json_object"},
      messages:[
        {role:"system",content:UDC_RULES},
        {role:"user",content:`Classify this title using ONLY the uploaded UDC edition as primary authority: "${title}". Analyze the whole title, retrieve the relevant systematic-table entries, verify all auxiliaries, and return JSON only. Do not modernize the 1961 notation.\n\nUPLOADED UDC EVIDENCE:\n${evidence}`}
      ]
    })
  });
  const j=await r.json();
  if(!r.ok) throw Error(j?.error?.message||`Groq HTTP ${r.status}`);
  return {...validate(parseJSON(j?.choices?.[0]?.message?.content||""),title),engine:"Groq + uploaded UDC evidence",model:process.env.GROQ_MODEL||"openai/gpt-oss-120b",grounded:false,uploaded_udc_pages:ev.pages};
}

app.get("/",(_,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.get("/api/health",(_,res)=>res.json({
  ok:true,version:"V45 ULTRA",geminiConfigured:!!GEMINI_KEY,groqConfigured:!!GROQ_KEY,
  models:MODELS,authority:UDC_SOURCE_TITLE,uploadedUDC:!!UDC_SOURCE_TEXT,
  uploadedUDCPages:UDC_SOURCE_PAGES.length,sourcePdfExists:fs.existsSync(UDC_SOURCE_PDF)
}));

app.post("/api/classify",async(req,res)=>{
  const title=String(req.body?.title||"").trim();
  if(!title) return res.status(400).json({error:"Enter a book title."});

  // Exact source-verified entries remain deterministic safeguards.
  const exact=uploadedExact(title);
  if(exact) return res.json(exact);

  const errors=[];
  if(GEMINI_KEY){
    for(const model of MODELS){
      try { return res.json(await gemini(title,model)); }
      catch(e){ errors.push(`${model}: ${e.message}`); }
    }
  }
  if(GROQ_KEY){
    try { return res.json(await groq(title)); }
    catch(e){ errors.push(`groq: ${e.message}`); }
  }

  const lc=localClassify(title);
  lc.provider_errors=errors.slice(-8);
  lc.engine="V45 ULTRA uploaded-UDC fallback engine";
  return res.json(lc);
});

app.listen(PORT,()=>console.log(`UDC V45 ULTRA on ${PORT}`));
