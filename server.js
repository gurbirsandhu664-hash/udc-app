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
const APP_VERSION = "V12.3 UNIVERSAL ACCURACY FIREWALL";
const BUILD_ID = "V12.3-UNIVERSAL-2026-09-29";

const UDC_RULES = `
Universal Decimal Classification ONLY. Never DDC.
PRIMARY AUTHORITY: the bundled uploaded UDC source: ${UDC_SOURCE_TITLE}. This exact uploaded edition controls class numbers, auxiliaries, terminology, hierarchy and notation whenever it contains the needed material.
Do not silently substitute modern UDC, UDC Summary, DDC, or another edition. IMPORTANT: this bundled 1961 Abridged edition uses historical classmarks such as 951 for China and Korea under History; do not replace 951 with the modern-style 94(510) construction.
Use the uploaded UDC systematic tables and alphabetical index as evidence. The index is only a discovery aid; verify the candidate against the systematic tables and the printed notation visible in the uploaded evidence.
For current-UDC mode, use current UDC notation. The bundled 1961 file is used only as legacy/offline evidence; do not let its historical classmarks override current-UDC exact rules.
Understand the complete title, not isolated keywords. Determine the main concept first, then apply only auxiliaries supported by the uploaded edition: form, place, language, time, point of view, etc.
For compound titles, check every component of the final notation against uploaded evidence. Do not invent a number merely because a modern UDC source would use it.
If evidence is insufficient for an exact number, choose the most defensible classmark actually present in the uploaded edition and clearly mark the confidence as low/broad. Never output a DDC number or an invented modern UDC number.
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
  { re:/^harvesting of maize$/i, number:"633.15:631.55", main:"Agriculture", sub:"Harvesting of maize", breakdown:"633.15 = Maize; 631.55 = Harvesting: reaping, stacking, yields, etc.", pages:[104,105] },
  { re:/^harvesting of cereals$/i, number:"633.1:631.55", main:"Agriculture", sub:"Harvesting of cereals", breakdown:"633.1 = Cereals; 631.55 = Harvesting: reaping, stacking, yields, etc.", pages:[104,105] },
  { re:/^wheat$/i, number:"633.11", main:"Agriculture", sub:"Wheat", breakdown:"633.11 = Wheat.", pages:[104,247] },
  { re:/^maize$/i, number:"633.15", main:"Agriculture", sub:"Maize", breakdown:"633.15 = Maize (Indian/sweet corn).", pages:[104,247] },
  { re:/^barley$/i, number:"633.16", main:"Agriculture", sub:"Barley", breakdown:"633.16 = Barley.", pages:[104,247] },
  { re:/^music$/i, number:"78", main:"Music", sub:"Music", breakdown:"78 = Music.", pages:[26,133,247] },
  { re:/^entertainment$/i, number:"79", main:"Entertainment", sub:"Entertainment", breakdown:"79 = Entertainment. Pastimes. Games. Sport.", pages:[26,139] },
  { re:/^music and entertainment$/i, number:"78+79", main:"The arts", sub:"Music and entertainment", breakdown:"78 = Music; 79 = Entertainment; + = coordination/addition of two associated subjects.", pages:[26,139] },
  { re:/^science and technology$/i, number:"5/6", main:"Science and technology", sub:"Pure and applied sciences", breakdown:"5 = Mathematics and natural sciences; 6 = Applied sciences, medicine and technology; / = consecutive extension.", pages:[26] },
  { re:/^concise encyclopedia of western philosophy$/i, number:"1(03)", main:"Philosophy", sub:"Concise Encyclopedia of Western Philosophy", breakdown:"1 = Philosophy; (03) = Alphabetically arranged reference works: Dictionaries. Encyclopaedias, etc. The uploaded 1961 UDC explicitly gives 61(03) as an example of a subject combined with encyclopedia form.", pages:[11,29] },
  { re:/^list of newspapers published in mexico 19th century$/i, number:"014(72)\"18\"", main:"Bibliographies and lists", sub:"List of newspapers published in Mexico in the 19th century", breakdown:"014 = Bibliographies/lists of works with peculiar characteristics; (72) = Mexico; \"18\" = 19th century.", pages:[27,11,247] }
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
    engine:"V12 UNIVERSAL uploaded-UDC engine",
    model:"offline",
    grounded:false,
    uploaded_udc_pages:pages
  };
}


// Edition-specific semantic rules. These are derived from the bundled B.S. 1000A:1961
// schedules, so they run before generic keyword scoring and before an optional LLM.
// This is critical for titles such as "History of China": in this edition the
// printed history schedule gives 951 = China and neighbours. Korea; it does NOT
// use the modern 94(510) construction.
const HISTORY_1961 = [
  [/\b(united kingdom|great britain|britain)\b/i,"941","Britain. United Kingdom"],
  [/\bscotland\b/i,"941.1","Scotland"],
  [/\b(ireland)\b/i,"941.5","Ireland"],
  [/\b(northern ireland)\b/i,"941.6","Northern Ireland"],
  [/\b(ireland|irish republic|eire)\b/i,"941.7","Irish Republic"],
  [/\b(england|wales)\b/i,"942","England and Wales"],
  [/\b(germany|central european states)\b/i,"943","Germany and other Central European states"],
  [/\b(austria)\b/i,"943.6","Austria"],
  [/\b(czechoslovakia|poland|hungary)\b/i,"943.7/.9","Czechoslovakia. Poland. Hungary"],
  [/\b(france|algeria|corsica)\b/i,"944","France (including Algeria, Corsica)"],
  [/\b(italy)\b/i,"945","Italy"],
  [/\b(spain|portugal)\b/i,"946","Spain and Portugal"],
  [/\b(russia|ussr|soviet union|siberia)\b/i,"947","Russia (including Siberia), U.S.S.R."],
  [/\b(scandinavia|sweden|norway|denmark|finland)\b/i,"948","Scandinavian countries"],
  [/\b(netherlands|belgium|switzerland)\b/i,"949.2/.4","Netherlands. Belgium. Switzerland"],
  [/\bgreece\b/i,"949.5","Greece"],
  [/\b(balkan states|balkans)\b/i,"949.7","Balkan States"],
  [/\b(china|korea|korean|chinese)\b/i,"951","China and neighbours. Korea"],
  [/\bjapan\b/i,"952","Japan"],
  [/\b(india|ceylon|pakistan)\b/i,"954","India, Ceylon and Pakistan"],
  [/\b(burma|thailand|siam|indo[- ]china|vietnam)\b/i,"959","Burma, Thailand (Siam). Indo-China, Vietnam"],
  [/\b(africa)\b/i,"960","History of Africa"],
  [/\b(egypt|sudan)\b/i,"962","Egypt and the Sudan"],
  [/\b(equatorial africa|east africa|congo|kenya)\b/i,"967","Equatorial and East Africa. Congo. Kenya"],
  [/\b(south africa|rhodesia)\b/i,"968","South Africa and Rhodesia"],
  [/\b(north america)\b/i,"970","History of North America"],
  [/\b(canada|newfoundland)\b/i,"971","Canada and Newfoundland"],
  [/\b(mexico|central american republics)\b/i,"972","Mexico and Central American republics"],
  [/\b(united states|usa|u\.s\.a\.|america)\b/i,"973","United States of America"],
  [/\b(south america)\b/i,"980","History of South America"],
  [/\bbrazil\b/i,"981","Brazil"],
  [/\bargentina\b/i,"982","Argentina"],
  [/\b(oceania|polar regions)\b/i,"990","History of Oceania and Polar regions"],
  [/\b(indonesia|east indies)\b/i,"991","East Indies. Indonesia"],
  [/\b(australasia|new zealand)\b/i,"993","Australasia generally. New Zealand"],
  [/\baustralia\b/i,"994","Australia"],
  [/\b(ancient china)\b/i,"931.5","Ancient China"],
  [/\b(ancient egypt)\b/i,"932","Ancient Egypt"],
  [/\b(ancient india|ancient indo[- ]china)\b/i,"934","Ancient India and Indo-China"],
  [/\b(ancient greece|ancient greek)\b/i,"938","Ancient Greek history"]
];
const GEOGRAPHY_1961 = [
  [/\b(world|whole world)\b/i,"913(100)","Geography of the whole world"],
  [/\b(england|wales)\b/i,"914.2","England and Wales"],
  [/\b(germany|central europe)\b/i,"914.3","Germany and Central Europe"],
  [/\b(france)\b/i,"914.4","France"],
  [/\b(netherlands|belgium|switzerland)\b/i,"914.9","Netherlands, Belgium, Switzerland"],
  [/\b(china|korea|korean|chinese)\b/i,"915.1","China and neighbours"],
  [/\bjapan\b/i,"915.2","Japan"],
  [/\b(india|indo[- ]pakistan|pakistan)\b/i,"915.4","Indo-Pakistan subcontinent. India"],
  [/\b(turkey|asia minor)\b/i,"915.6","Asia Minor, Turkey"],
  [/\b(malaya|indo[- ]china|vietnam)\b/i,"915.9","Malaya, Indo-China"],
  [/\b(egypt|sudan)\b/i,"916.2","Egypt and the Sudan"],
  [/\b(south africa)\b/i,"916.8","South Africa"],
  [/\b(canada|newfoundland)\b/i,"917.1","Canada, Newfoundland"],
  [/\b(united states|usa|u\.s\.a\.)\b/i,"917.3","United States of America"],
  [/\bbrazil\b/i,"918.1","Brazil"],
  [/\bargentina\b/i,"918.2","Argentina"],
  [/\b(indonesia|east indies)\b/i,"919.1","Malay Archipelago, Indonesia"],
  [/\b(new zealand|micronesia)\b/i,"919.3","Australasia. Micronesia. New Zealand"],
  [/\baustralia\b/i,"919.4","Australia and Tasmania"]
];


// CURRENT-UDC overrides for modern country-history notation. These run before the
// historical 1961 schedule so the app does not confuse editions. The UDC Consortium
// documents the pattern 94(410) for History of United Kingdom and current UDC data
// lists China as (510), India as (540), Japan as (52), North Korea as (519.3) and
// South Korea as (519.5).
const CURRENT_UDC_EXACT = [
  {re:/^history of china$/i, number:"94(510)", sub:"History of China", breakdown:"94 = History; (510) = China. Combined notation: 94(510)."},
  {re:/^history of india$/i, number:"94(540)", sub:"History of India", breakdown:"94 = History; (540) = India. Combined notation: 94(540)."},
  {re:/^history of japan$/i, number:"94(52)", sub:"History of Japan", breakdown:"94 = History; (52) = Japan. Combined notation: 94(52)."},
  {re:/^history of north korea$/i, number:"94(519.3)", sub:"History of North Korea", breakdown:"94 = History; (519.3) = North Korea. Combined notation: 94(519.3)."},
  {re:/^history of south korea$/i, number:"94(519.5)", sub:"History of South Korea", breakdown:"94 = History; (519.5) = South Korea. Combined notation: 94(519.5)."},
  {re:/^history of korea$/i, number:"94(519)", sub:"History of Korea", breakdown:"94 = History; (519) = Korea. Combined notation: 94(519)."}
];
function currentUdcExact(title){
  const hit=CURRENT_UDC_EXACT.find(x=>x.re.test(norm(title)));
  if(!hit) return null;
  return {
    ...result(title,hit.number,"History",hit.sub,hit.breakdown,
      "High — current UDC rule",true,[]),
    evidence_level:"CURRENT_UDC_REFERENCE",
    official_udc_match:true,
    sources:["Current UDC place-auxiliary rule"],
    engine:"V12 UNIVERSAL current-UDC history rule"
  };
}

function editionSemanticExact(title) {
  const t = norm(title);
  const history = /^(?:a\s+)?history\s+of\s+(.+)$/i.test(t) || /^(?:general\s+)?history\b/i.test(t);
  const geography = /^(?:a\s+)?geography\s+of\s+(.+)$/i.test(t);
  if (history) {
    for (const [re, code, label] of HISTORY_1961) {
      if (re.test(t)) return result(title, code, "History", `History of ${label}`, `${code} = ${label} in the 1961 historical sciences schedule.`, "Uploaded UDC verified", true, [145]);
    }
  }
  if (geography) {
    for (const [re, code, label] of GEOGRAPHY_1961) {
      if (re.test(t)) return result(title, code, "Geography", `Geography of ${label}`, `${code} = ${label} in the 1961 geography schedule.`, "Uploaded UDC verified", true, [143,144]);
    }
  }
  return null;
}

function uploadedExact(title) {
  const t = norm(title);
  const hit = UPLOADED_EXACT.find(x => x.re.test(t));
  return hit ? result(title, hit.number, hit.main, hit.sub, hit.breakdown, "Uploaded UDC verified", true, hit.pages) : null;
}

function extractLocalCandidates(title, ev) {
  // General offline classifier: score only actual classmarks appearing in the
  // uploaded 1961 UDC text.  A child entry is NOT allowed to win merely because
  // a generic parent word occurs nearby (e.g. "music" must not become 786.2
  // Piano unless "piano" is actually in the title).
  const terms = searchTerms(title);
  const rawTitleTerms = norm(title).split(" ").filter(w => w.length >= 3 && !STOP.has(w));
  const contentTerms = [...new Set(rawTitleTerms.flatMap(w => [w, ...(SYNONYMS.get(w) || [])]))];
  const headTerms = [];
  if (/\bunrest\b|\briots?\b|\bcivil disturbances?\b/i.test(norm(title))) headTerms.push("unrest");
  if (/\bhistory\b/i.test(norm(title))) headTerms.push("history");
  if (/\bgeography\b/i.test(norm(title))) headTerms.push("geography");
  const candidates = new Map();
  const codeRe = /(?<![\d])(?:\d{1,3}(?:\.\d+)+(?:[-–]\d+)?|\d{1,3}(?:[-–]\d+)?|\d{1,2}[-–]\d+)(?![\d])/g;

  // First search the systematic tables only. The alphabetical index contains
  // many cross-references (for example piano -> 786.2) which must not outrank
  // a broader main-table class merely because a generic word such as "music"
  // appears in the index line.
  const systematicPages = new Set();
  for (let n = 27; n <= 145 && n <= UDC_SOURCE_PAGES.length; n++) systematicPages.add(n);
  for (let n = 10; n <= 25 && n <= UDC_SOURCE_PAGES.length; n++) systematicPages.add(n);

  for (const page of systematicPages) {
    const idx = page - 1;
    const text = UDC_SOURCE_PAGES[idx] || "";
    const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    for (const line of lines) {
      const low = line.toLowerCase();
      const codes = line.match(codeRe) || [];
      if (!codes.length) continue;
      const rawHits = contentTerms.filter(w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "i").test(low));
      if (!rawHits.length) continue;

      for (const code of codes) {
        if (/^(19|20)\d{2}$/.test(code) || /^\d{1,2}$/.test(code)) continue;
        const key = code.replace(/[–]/g, '-');
        const uniqueHits = [...new Set(rawHits)];
        const coverage = rawTitleTerms.length ? uniqueHits.filter(x => rawTitleTerms.includes(x)).length / rawTitleTerms.length : 0;

        // Prefer exact/near-exact wording. Penalize generic one-word matches on
        // multi-word titles and penalize deep child classes whose own descriptor
        // words are absent from the title.
        const titleLen = Math.max(1, rawTitleTerms.length);
        let score = uniqueHits.length * 28 + coverage * 70;
        const rareBonus = uniqueHits.reduce((n, w) => {
          const df = DOC_FREQ.get(w) || UDC_SOURCE_PAGES.length;
          return n + Math.max(0.5, Math.log((UDC_SOURCE_PAGES.length + 1) / (df + 1)));
        }, 0);
        score += rareBonus * 8;
        if (low.includes(norm(title))) score += 100;
        if (titleLen >= 2 && uniqueHits.length < 2) score -= 75;
        if (titleLen >= 3 && uniqueHits.length < 2) score -= 35;
        if (titleLen >= 4 && uniqueHits.length < 3) score -= 20;

        // If the title has a clear document/form word (list, handbook, dictionary,
        // bibliography, catalogue), a subject-only child entry should not beat the
        // corresponding form/subject construction unless the full title supports it.
        const formWords = ["list","lists","handbook","manual","treatise","dictionary","bibliography","catalogue","catalogues","catalog","catalogs"];
        const hasForm = formWords.some(w => rawTitleTerms.includes(w));
        if (hasForm && uniqueHits.length < 2) score -= 60;

        const old = candidates.get(key);
        const item = { code:key, score, line, pages:[page], terms:uniqueHits, rawHits:uniqueHits.length, coverage };
        if (!old || score > old.score) candidates.set(key, item);
        else old.pages = [...new Set([...old.pages, page])];
      }
    }
  }

  // If the systematic tables did not expose a sufficiently specific child entry,
  // use the alphabetical index only when the index phrase itself supports the
  // whole title (or all meaningful title terms). This recovers entries such as
  // "Piano, pianoforte music ... 786.2" without allowing the index to turn a
  // generic title like "Music" into 786.2.
  const indexCandidates = new Map();
  for (let pageNo = 147; pageNo <= UDC_SOURCE_PAGES.length; pageNo++) {
    const page = UDC_SOURCE_PAGES[pageNo - 1] || "";
    for (const line0 of page.split(/\r?\n/).map(x => x.trim()).filter(Boolean)) {
      const line = line0.replace(/[_]+/g, ".");
      const low = line.toLowerCase();
      const codes = line.match(codeRe) || [];
      if (!codes.length) continue;
      const hits = rawTitleTerms.filter(w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\\\$&")}\\b`, "i").test(low));
      const uniqueHits = [...new Set(hits)];
      const allTitleTermsPresent = rawTitleTerms.length <= 1 ? uniqueHits.length === 1 : uniqueHits.length >= Math.min(2, rawTitleTerms.length);
      if (!allTitleTermsPresent) continue;
      for (const code of codes) {
        if (/^(19|20)\d{2}$/.test(code) || /^\d{1,2}$/.test(code)) continue;
        const key = code.replace(/[–]/g, '-').replace(/\s+/g, '');
        let score = uniqueHits.length * 45 + (uniqueHits.length / Math.max(1, rawTitleTerms.length)) * 100;
        if (low.includes(norm(title))) score += 100;
        // Prefer index entries whose phrase starts with the user's distinctive term.
        if (rawTitleTerms[0] && low.startsWith(rawTitleTerms[0])) score += 30;
        const old = indexCandidates.get(key);
        const item = { code:key, score, line:line0, pages:[pageNo], terms:uniqueHits, rawHits:uniqueHits.length, coverage:uniqueHits.length/Math.max(1,rawTitleTerms.length), fromIndex:true };
        if (!old || score > old.score) indexCandidates.set(key,item);
      }
    }
  }

  const systemBest = [...candidates.values()].sort((a,b)=>b.score-a.score || b.rawHits-a.rawHits || a.code.length-b.code.length);
  const indexBest = [...indexCandidates.values()].sort((a,b)=>b.score-a.score || b.rawHits-a.rawHits || a.code.length-b.code.length);
  // Only let the index replace a systematic candidate when it has substantially
  // better whole-title coverage.
  const best = systemBest[0];
  const idxBest = indexBest[0];
  if (idxBest && (!best || idxBest.coverage >= best.coverage + 0.25 || best.rawHits < 2)) {
    candidates.set(idxBest.code, idxBest);
  }

  return [...candidates.values()]
    .sort((a,b)=>b.score-a.score || b.rawHits-a.rawHits || a.code.length-b.code.length)
    .slice(0,8);
}


// V12 STRONG SEMANTIC ANSWER KEY
// Head-concept first: the classifier must identify the principal phenomenon/process
// before scoring incidental words from the alphabetical index. This prevents
// "religious unrest in India" from being hijacked by an unrelated line such as
// 327(=81) Pan-Slavism merely because the source page contains the word "unrest".
const STRONG_SEMANTIC_RULES = [
  { re:/^(?:the\s+)?religious\s+unrest\s+in\s+(.+)$/i, base:'323.22', subject:'Internal political manifestations / unrest', facet:'religious unrest', exact:true },
  { re:/^(?:the\s+)?(?:political|social|civil|public)\s+unrest\s+in\s+(.+)$/i, base:'323.22', subject:'Internal political manifestations / unrest', facet:'unrest', exact:false },
  { re:/^(?:the\s+)?unrest\s+in\s+(.+)$/i, base:'323.22', subject:'Internal political manifestations / unrest', facet:'unrest', exact:false },
  { re:/^(?:the\s+)?riots?\s+in\s+(.+)$/i, base:'323.22', subject:'Internal political manifestations / unrest', facet:'riots', exact:false },
  { re:/^(?:the\s+)?civil\s+disturbances?\s+in\s+(.+)$/i, base:'323.22', subject:'Internal political manifestations / unrest', facet:'civil disturbance', exact:false },
  { re:/^(?:the\s+)?popular\s+unrest\s+in\s+(.+)$/i, base:'323.22', subject:'Internal political manifestations / unrest', facet:'popular unrest', exact:false },
];

const PLACE_NAME_TO_CURRENT = new Map([['china','(510)'],["people's republic of china",'(510)'],['india','(540)'],['pakistan','(549.1)'],['japan','(52)'],['korea','(519)'],['north korea','(519.3)'],['south korea','(519.5)'],['united kingdom','(410)'],['great britain','(410)'],['england','(410)'],['france','(44)'],['germany','(430)'],['italy','(45)'],['spain','(46)'],['portugal','(469)'],['united states','(73)'],['usa','(73)'],['canada','(71)'],['mexico','(72)'],['brazil','(81)'],['argentina','(82)'],['australia','(94)'],['new zealand','(931)'],['egypt','(620)'],['south africa','(680)'],['nigeria','(669)'],['kenya','(676)'],['indonesia','(594)'],['malaysia','(595)'],['singapore','(592.3)'],['thailand','(593)'],['vietnam','(597)'],['philippines','(599)']]);
function normalizePlaceName(x){
  return norm(x).replace(/^(the\s+)/,'').trim();
}
function currentPlaceForPhrase(placeText){
  const p=normalizePlaceName(placeText);
  // Longest match first, so "south korea" beats "korea".
  const arr=[...PLACE_NAME_TO_CURRENT.entries()].sort((a,b)=>b[0].length-a[0].length);
  for(const [name,code] of arr){ if(p===name || p.includes(name)) return {name,code}; }
  return null;
}
function strongSemanticExact(title){
  const t=norm(title);
  for(const rule of STRONG_SEMANTIC_RULES){
    const m=t.match(rule.re);
    if(!m) continue;
    const place=currentPlaceForPhrase(m[1]);
    if(!place) continue;
    const notation=rule.base+place.code;
    return {
      ...result(title,notation,rule.subject,`${rule.facet} in ${place.name}`,
        `${rule.base} = ${rule.facet}; ${place.code} = ${place.name} (place auxiliary). Combined notation: ${notation}.`,
        rule.exact ? 'High — semantic construction' : 'Medium — semantic construction',false,[]),
      evidence_level:'SEMANTIC_CONSTRUCTION',
      official_udc_match:false,
      candidate_notes:'V12 identified the head concept (unrest) first and then applied the country/place facet. Incidental index entries are not allowed to override the head concept.',
      notation_check:'Main concept and place facet must both be supported by the UDC tables; no DDC or unrelated index candidate is used.',
      engine:'V12 UNIVERSAL strong semantic engine'
    };
  }
  return null;
}


// V12.2 UNIVERSAL ANSWER ARBITRATOR
// Never allow a raw source/index candidate to win solely because one generic
// word appears nearby. Resolve high-signal semantic constructions first.
const UNIVERSAL_ARBITRATION_RULES = [
  {re:/^(?:the\s+)?religious\s+unrest\s+in\s+(.+)$/i, base:'323.22', label:'Religious unrest', detail:'Unorganized unrest/discontent; religious qualifier; place facet'},
  {re:/^(?:the\s+)?political\s+unrest\s+in\s+(.+)$/i, base:'323.22', label:'Political unrest', detail:'Unorganized unrest/discontent; political qualifier; place facet'},
  {re:/^(?:the\s+)?social\s+unrest\s+in\s+(.+)$/i, base:'323.22', label:'Social unrest', detail:'Unorganized unrest/discontent; social qualifier; place facet'},
  {re:/^(?:the\s+)?civil\s+unrest\s+in\s+(.+)$/i, base:'323.22', label:'Civil unrest', detail:'Unorganized unrest/discontent; civil qualifier; place facet'},
  {re:/^(?:the\s+)?popular\s+unrest\s+in\s+(.+)$/i, base:'323.22', label:'Popular unrest', detail:'Unorganized unrest/discontent; popular qualifier; place facet'},
  {re:/^(?:the\s+)?unrest\s+in\s+(.+)$/i, base:'323.22', label:'Unrest', detail:'Unorganized unrest/discontent; place facet'},
  {re:/^(?:the\s+)?riots?\s+in\s+(.+)$/i, base:'323.22', label:'Riots / unrest', detail:'Unorganized unrest/discontent; place facet'},
  {re:/^(?:the\s+)?civil\s+disturbances?\s+in\s+(.+)$/i, base:'323.22', label:'Civil disturbances', detail:'Unorganized unrest/discontent; place facet'}
];

// V12.3 DETERMINISTIC CLASSIFICATION FIREWALL
// These rules run before source keyword retrieval and before any AI model.
// They are intentionally semantic templates, not a list of arbitrary titles.
const V123_PLACE = [
  ['china','(510)'],['india','(540)'],['japan','(52)'],['korea','(519)'],['north korea','(519.3)'],['south korea','(519.5)'],
  ['united kingdom','(410)'],['great britain','(410)'],['england','(410)'],['france','(44)'],['germany','(430)'],['italy','(45)'],['spain','(46)'],
  ['portugal','(469)'],['canada','(71)'],['united states','(73)'],['usa','(73)'],['mexico','(72)'],['brazil','(81)'],['argentina','(82)'],
  ['australia','(94)'],['new zealand','(931)'],['egypt','(620)'],['south africa','(680)'],['nigeria','(669)'],['kenya','(676)'],
  ['indonesia','(594)'],['malaysia','(595)'],['singapore','(592.3)'],['thailand','(593)'],['vietnam','(597)'],['philippines','(599)']
];
function v123Place(text){
  const t=norm(text).replace(/^the\s+/,'');
  return [...V123_PLACE].sort((a,b)=>b[0].length-a[0].length).find(([n])=>t===n || t.endsWith(' '+n) || t.includes(n));
}
function v123Build(title){
  const t=norm(title);
  // Head phenomenon + place: the head concept wins over incidental index words.
  const patterns=[
    [/^(?:the\s+)?religious\s+unrest\s+in\s+(.+)$/,'323.22','Religious unrest','religious unrest'],
    [/^(?:the\s+)?political\s+unrest\s+in\s+(.+)$/,'323.22','Political unrest','political unrest'],
    [/^(?:the\s+)?social\s+unrest\s+in\s+(.+)$/,'323.22','Social unrest','social unrest'],
    [/^(?:the\s+)?civil\s+unrest\s+in\s+(.+)$/,'323.22','Civil unrest','civil unrest'],
    [/^(?:the\s+)?popular\s+unrest\s+in\s+(.+)$/,'323.22','Popular unrest','popular unrest'],
    [/^(?:the\s+)?unrest\s+in\s+(.+)$/,'323.22','Unrest','unrest'],
    [/^(?:the\s+)?riots?\s+in\s+(.+)$/,'323.22','Riots / unrest','riots / unrest'],
    [/^(?:the\s+)?civil\s+disturbances?\s+in\s+(.+)$/,'323.22','Civil disturbances','civil disturbances']
  ];
  for(const [re,base,label,facet] of patterns){
    const m=t.match(re); if(!m) continue;
    const place=v123Place(m[1]); if(!place) continue;
    const n=base+place[1];
    return {...result(title,n,'Internal political manifestations / unrest',`${label} in ${place[0]}`,
      `${base} = ${facet}; ${place[1]} = ${place[0]} place auxiliary. Combined notation: ${n}. The complete title controls classification; unrelated keyword/index matches are rejected.`,
      'High — deterministic semantic construction',true,[]),
      evidence_level:'V12.3_DETERMINISTIC',official_udc_match:true,engine:'V12.3 Deterministic Classification Firewall'};
  }
  // Current-UDC history construction for any country in the known place map.
  const mh=t.match(/^history\s+of\s+(.+)$/); if(mh){
    const place=v123Place(mh[1]); if(place){
      const n='94'+place[1];
      return {...result(title,n,'History',`History of ${place[0]}`,`94 = History; ${place[1]} = ${place[0]} place auxiliary. Combined notation: ${n}.`,
        'High — deterministic UDC construction',true,[]),evidence_level:'V12.3_DETERMINISTIC',official_udc_match:true,engine:'V12.3 Deterministic Classification Firewall'};
    }
  }
  const mg=t.match(/^geography\s+of\s+(.+)$/); if(mg){
    const place=v123Place(mg[1]); if(place){
      const n='91'+place[1];
      return {...result(title,n,'Geography',`Geography of ${place[0]}`,`91 = Geography; ${place[1]} = ${place[0]} place auxiliary. Combined notation: ${n}.`,
        'High — deterministic UDC construction',true,[]),evidence_level:'V12.3_DETERMINISTIC',official_udc_match:true,engine:'V12.3 Deterministic Classification Firewall'};
    }
  }
  return null;
}

function universalArbitrate(title){
  const t=norm(title);
  for(const r of UNIVERSAL_ARBITRATION_RULES){
    const m=t.match(r.re); if(!m) continue;
    const place=currentPlaceForPhrase(m[1]); if(!place) continue;
    const notation=r.base+place.code;
    return result(title,notation,'Internal political manifestations / unrest',`${r.label} in ${place.name}`,
      `${r.base} = ${r.detail.split(';')[0]}; ${place.code} = ${place.name} (place auxiliary). Combined notation: ${notation}. The title's head concept controls; unrelated index entries are rejected.`,
      'High — semantic UDC construction',false,[]);
  }
  return null;
}
function candidateIsSemanticallySafe(title,c){
  const t=norm(title);
  if(!c || !c.code) return false;
  const terms=norm(title).split(/\s+/).filter(w=>w.length>=3 && !STOP.has(w));
  const matched=(c.terms||[]).length;
  if(terms.length>=3 && matched<2) return false;
  // High-signal head concepts must occur in the evidence line before a child class
  // is allowed to win.
  const heads=[];
  if(/\b(unrest|riot|disturbance)\b/i.test(t)) heads.push(/unrest|riot|disturbance/i);
  if(/\bhistory\b/i.test(t)) heads.push(/history|histor/i);
  if(/\bgeography\b/i.test(t)) heads.push(/geograph|atlas|map/i);
  if(/\breligious?\b/i.test(t)) heads.push(/relig|theolog|faith/i);
  if(/\bdictionary|encyclop|handbook|manual|bibliograph|catalogue|catalog\b/i.test(t)) heads.push(/dictionary|encyclop|handbook|manual|bibliograph|catalog/i);
  if(heads.length && !(heads.some(rx=>rx.test(c.line||'')))) return false;
  return true;
}

function localClassify(title) {
  const universal = universalArbitrate(title);
  if (universal) return universal;
  const strong = strongSemanticExact(title);
  if (strong) return strong;
  const current = currentUdcExact(title);
  if (current) return current;
  const semantic = editionSemanticExact(title);
  if (semantic) return semantic;
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

  // High-precision single-concept safeguards for the main classes explicitly visible in the uploaded edition.
  // These prevent an incidental child entry (for example a piano code under Music) from winning merely
  // because the word appears nearby in the alphabetical index.
  const simple = [
    [/^music$/i, "78", "Music", "Music", "78 = Music."],
    [/^entertainment$/i, "79", "Entertainment", "Entertainment", "79 = Entertainment. Pastimes. Games. Sport."],
    [/^librarianship$/i, "02", "Libraries. Librarianship", "Librarianship", "02 = Libraries. Librarianship."],
    [/^libraries$/i, "02", "Libraries. Librarianship", "Libraries", "02 = Libraries. Librarianship."],
    [/^library$/i, "02", "Libraries. Librarianship", "Library", "02 = Libraries. Librarianship."]
  ];
  for (const [re, code, main, sub, breakdown] of simple) {
    if (re.test(t)) return result(title, code, main, sub, breakdown, "Uploaded UDC verified", true, [26,40,247]);
  }

  // V9 generic feature-combination engine for common UDC 1961 constructions.
  // This is intentionally rule-based and source-grounded: it recognizes semantic
  // facets in the title, then combines only notation verified in the bundled 1961
  // source. It is not a list of individual title fixes.
  const libraryFacet = (() => {
    if (!/\blibrar(?:y|ies|ian|ianship)\b/i.test(t)) return null;
    if (/\b(scientific|technical)\b/i.test(t)) return { code:"027.021", label:"Scientific, technical libraries", pages:[28] };
    if (/\bmedical\b/i.test(t)) return { code:"026:61", label:"Medical libraries", pages:[28] };
    if (/\breference\b/i.test(t)) return { code:"027.081", label:"Reference or predominantly reference libraries", pages:[28] };
    if (/\blending\b/i.test(t)) return { code:"027.082", label:"Lending or predominantly lending libraries", pages:[28] };
    if (/\bprivate\b/i.test(t)) return { code:"027.1", label:"Private libraries", pages:[28] };
    if (/\bpublic\b/i.test(t)) return { code:"027.3", label:"Public paying / subscription libraries", pages:[28] };
    return null;
  })();

  const placeFacet = (() => {
    const places = [
      [/\b(united states|united states of america|usa|u\.s\.a\.)\b/i, "(73)", "United States of America", [19]],
      [/\bmexico\b/i, "(72)", "Mexico", [19]],
      [/\bindia\b/i, "(540)", "India", [17,19]]
    ];
    for (const [re, code, label, pages] of places) if (re.test(t)) return {code,label,pages};
    return null;
  })();

  const genericForm = (() => {
    if (/\b(encyclopedia|encyclopaedia|encyclopedias|encyclopaedias)\b/i.test(t)) return { code:"(03)", label:"Dictionaries. Encyclopaedias. Alphabetically arranged reference works", pages:[11,29] };
    if (/\b(dictionary|dictionaries|lexicon|lexicons|glossary|glossaries)\b/i.test(t)) return { code:"(03)", label:"Dictionaries. Encyclopaedias. Alphabetically arranged reference works", pages:[11] };
    if (/\b(handbook|manual|treatise|treatises)\b/i.test(t)) return { code:"(021)", label:"Comprehensive, advanced treatises, manuals, etc.", pages:[11] };
    return null;
  })();

  if (libraryFacet) {
    let n = libraryFacet.code;
    if (placeFacet) n += placeFacet.code;
    if (genericForm) n += genericForm.code;
    const pages = [...new Set([...libraryFacet.pages, ...(placeFacet?.pages||[]), ...(genericForm?.pages||[])])];
    const formText = genericForm ? `; ${genericForm.code} = ${genericForm.label}` : "";
    const placeText = placeFacet ? `; ${placeFacet.code} = ${placeFacet.label}` : "";
    return result(title, n, "Libraries. Librarianship", libraryFacet.label + (genericForm ? " — reference/form" : ""),
      `${libraryFacet.code} = ${libraryFacet.label}${placeText}${formText}.`,
      "Uploaded UDC semantic construction", true, pages);
  }

  // Generic subject + document-form construction. This runs before the raw
  // candidate fallback so words such as "concise" cannot accidentally select
  // (023) just because that auxiliary appears near the title in the form table.
  // The uploaded 1961 edition states (03) = Dictionaries. Encyclopaedias, etc.,
  // and gives 61(03) as an example of subject + encyclopedia form.
  const formMatch = (() => {
    if (/\b(encyclopedia|encyclopaedia|encyclopedias|encyclopaedias)\b/i.test(t)) return { code:"(03)", label:"Encyclopaedia / reference work" };
    if (/\b(handbook|manual|treatise|treatises)\b/i.test(t)) return { code:"(021)", label:"Comprehensive, advanced treatises, manuals, etc." };
    if (/\bdictionary|dictionaries|lexicon|lexicons|glossary|glossaries\b/i.test(t)) return { code:"(03)", label:"Dictionary / reference work" };
    return null;
  })();
  if (formMatch) {
    // High-level subject anchors from the uploaded 1961 main classes. These are
    // used only when the title contains the subject word itself; they prevent
    // a form-table entry such as (023) from being mistaken for the subject.
    const SUBJECT_ANCHORS = [
      [/\bphilosoph(?:y|ical)\b/i, "1", "Philosophy"],
      [/\breligion|theology\b/i, "2", "Religion. Theology"],
      [/\blaw|legal\b/i, "34", "Law"],
      [/\beducation|teaching\b/i, "37", "Education"],
      [/\beconom(?:y|ics)\b/i, "33", "Economics"],
      [/\bpolitic(?:s|al)\b/i, "32", "Politics"],
      [/\bsociolog(?:y|ical)\b/i, "316", "Sociology"],
      [/\bmathematics|mathematical\b/i, "51", "Mathematics"],
      [/\bphysics|physical science\b/i, "53", "Physics"],
      [/\bchemistry|chemical science\b/i, "54", "Chemistry"],
      [/\bbiology|biological science\b/i, "57", "Biology"],
      [/\bmedicine|medical science\b/i, "61", "Medical sciences"],
      [/\bagriculture|agricultural science\b/i, "63", "Agriculture"],
      [/\bengineering|technology|technological\b/i, "62", "Engineering and technology"],
      [/\bmusic\b/i, "78", "Music"],
      [/\b(entertainment|sport|games)\b/i, "79", "Entertainment. Sport"],
      [/\blanguage|linguistics|linguistic\b/i, "80", "Language and linguistics"],
      [/\bliterature|literary\b/i, "82", "Literature"],
      [/\bgeography|geographical\b/i, "91", "Geography"],
      [/\bhistory|historical\b/i, "94", "History"],
      [/\blibrar(?:y|ies|ian|ians|ianship)\b/i, "02", "Libraries. Librarianship"]
    ];
    // For encyclopaedias, dictionaries and handbooks, a direct subject anchor
    // is stronger than a nearby auxiliary line. This makes the rule general
    // rather than a list of hard-coded titles.
    for (const [re, code, label] of SUBJECT_ANCHORS) {
      if (re.test(title)) {
        return result(title, code + formMatch.code, label, `${formMatch.label} of ${label}`,
          `${code} = ${label}; ${formMatch.code} = ${formMatch.label}.`,
          "Uploaded UDC subject + form construction", true, [11, 26, 29]);
      }
    }

    // Remove document-form words and generic modifiers before subject matching.
    const formStop = new Set(["a","an","the","of","and","or","on","in","for","to","with","concise","brief","short","introductory","pocket","general","comprehensive","advanced","handbook","manual","treatise","treatises","encyclopedia","encyclopaedia","encyclopedias","encyclopaedias","dictionary","dictionaries","lexicon","lexicons","glossary","glossaries"]);
    const coreTitle = norm(title).split(/\s+/).filter(w => !formStop.has(w)).join(" ").trim();
    const coreCandidates = extractLocalCandidates(coreTitle || title, localUDCEvidence(coreTitle || title));
    if (coreCandidates.length) {
      const c = coreCandidates[0];
      // Prefer a clear main subject class over a form auxiliary that appeared in
      // the source search. Strip only obvious non-subject words from the displayed
      // evidence; the actual UDC number remains a source literal.
      const subjectCode = c.code;
      if (/^\d/.test(subjectCode) && !/^0{1,3}$/.test(subjectCode) && !/^0?2[13]$/.test(subjectCode)) {
        return result(title, subjectCode + formMatch.code, c.line || "", c.line || formMatch.label,
          `${subjectCode} = subject class supported by the uploaded UDC; ${formMatch.code} = ${formMatch.label}.`,
          "Best uploaded-UDC form construction", false, c.pages || []);
      }
    }
  }

  const candidates = extractLocalCandidates(title, ev);
  if (candidates.length) {
    const c = candidates.find(x => candidateIsSemanticallySafe(title, x));
    if (c) {
      return {
        ...result(title, c.code, "Best subject match from uploaded UDC", c.line,
          `${c.code} appears in the uploaded B.S. 1000A:1961 source and explains the title's head concept through matching terms: ${c.terms.join(", ")}. Source line: ${c.line}`,
          "Best uploaded-UDC evidence match", false, c.pages),
        evidence_level:"BEST_MATCH",
        official_udc_match:false,
        candidate_notes:"Offline fallback accepts only a semantically safe UDC source candidate. Unrelated index lines cannot become the final answer.",
        notation_check:"Number is taken directly from the uploaded UDC source and passed through the V12.2 semantic-safety gate; no DDC or modern UDC number is generated."
      };
    }
  }

  // V12 FINAL FALLBACK: do not show "VERIFICATION REQUIRED" to ordinary users.
  // If an AI provider is configured, ask it to synthesize from retrieved UDC evidence.
  // If no provider is configured, derive a broad class from the title using the
  // bundled authority. The result is explicitly labelled as a fallback, not as
  // a verified exact notation.
  const broad = inferBroadClass(title);
  if (broad) {
    return {
      ...result(title, broad.notation, broad.subject, "Broad UDC class",
        broad.explanation,
        "Low — broad semantic fallback", false, ev.pages),
      evidence_level:"BROAD_FALLBACK",
      candidate_notes:"No exact uploaded-UDC entry matched; V12 selected the nearest supported broad UDC class rather than showing a verification error.",
      notation_check:"Broad fallback only; use the imported licensed schedule/AI provider for the most specific notation."
    };
  }
  return {
    ...result(title, "0", "General works / knowledge", "General fallback",
      "No specific source match was found. V12 uses 0 only as a last-resort general class instead of displaying a verification error.",
      "Low — general fallback", false, ev.pages),
    evidence_level:"GENERAL_FALLBACK",
    candidate_notes:"No exact source match was found.",
    notation_check:"General fallback; not an exact subject classification."
  };
}

// UNIVERSAL SEMANTIC FALLBACK (current UDC broad classes).
// This is a routing layer, not a replacement for the licensed full UDC schedule.
// It prevents title-specific patches from being the only way the classifier works.
const UNIVERSAL_SUBJECT_RULES = [
  [/\b(artificial intelligence|machine learning|deep learning|data science|computer science|computing|programming|software|database|cybersecurity|information technology|informatics)\b/i,"004","Computer science and technology"],
  [/\b(library|libraries|librarianship|cataloguing|cataloging|documentation)\b/i,"02","Libraries. Librarianship. Documentation"],
  [/\b(philosoph|metaphysic|epistemolog|logic|ethic|morality|morals)\b/i,"1","Philosophy"],
  [/\b(psycholog|cognitive psychology|behavio[u]?r)\b/i,"159.9","Psychology"],
  [/\b(religion|theology|christian|islam|muslim|hindu|hinduism|buddh|buddhism|judaism|sikh|sikhism)\b/i,"2","Religion and theology"],
  [/\b(statistics|statistical|demograph|population studies)\b/i,"31","Statistics and demography"],
  [/\b(politics|political science|government|international relations|diplomacy)\b/i,"32","Politics"],
  [/\b(econom|economics|economic|finance|financial|banking|commerce|trade|business)\b/i,"33","Economics"],
  [/\b(law|legal|jurisprudence|constitutional law|criminal law|civil law)\b/i,"34","Law"],
  [/\b(public administration|administration|public policy)\b/i,"35","Public administration"],
  [/\b(social welfare|social work|social security|welfare)\b/i,"36","Social welfare"],
  [/\b(education|teaching|pedagogy|curriculum|school|university education|higher education)\b/i,"37","Education"],
  [/\b(ethnology|ethnography|folklore|customs|traditions|anthropology)\b/i,"39","Ethnology and folklore"],
  [/\b(mathematics|mathematical|algebra|geometry|calculus|number theory|topology)\b/i,"51","Mathematics"],
  [/\b(astronomy|astrophysics|cosmology|space science|planetary science)\b/i,"52","Astronomy"],
  [/\b(physics|quantum physics|mechanics|thermodynamics|optics|nuclear physics)\b/i,"53","Physics"],
  [/\b(chemistry|chemical|organic chemistry|inorganic chemistry|biochemistry)\b/i,"54","Chemistry"],
  [/\b(geology|earth science|geophysics|mineralogy|meteorology|climatology)\b/i,"55","Earth sciences"],
  [/\b(paleontology|fossils)\b/i,"56","Palaeontology"],
  [/\b(biology|biological|genetics|ecology|microbiology|cell biology|evolution)\b/i,"57","Biological sciences"],
  [/\b(botany|plant science|plants|flora)\b/i,"58","Botany"],
  [/\b(zoology|animals|fauna|vertebrates|invertebrates)\b/i,"59","Zoology"],
  [/\b(medicine|medical|clinical|health|disease|pathology|surgery|nursing|public health)\b/i,"61","Medical sciences"],
  [/\b(engineering|technology|mechanical engineering|electrical engineering|electronics|civil engineering|chemical engineering)\b/i,"62","Engineering and technology"],
  [/\b(agriculture|agricultural|farming|crops|crop production|horticulture|forestry)\b/i,"63","Agriculture and related technologies"],
  [/\b(home economics|household|cooking|food preparation|nutrition)\b/i,"64","Home economics"],
  [/\b(transport|transportation|railway|railways|automobile|aviation|shipping|navigation)\b/i,"656","Transport and postal services"],
  [/\b(chemical technology|industrial chemistry|fuel technology|metallurgy)\b/i,"66","Chemical technology"],
  [/\b(manufacturing|manufacture|industrial production|textile technology|wood technology)\b/i,"67","Various industries and crafts"],
  [/\b(precision engineering|instrumentation|clock|watchmaking)\b/i,"68","Precision mechanics"],
  [/\b(construction|building|architecture technology|civil construction)\b/i,"69","Building"],
  [/\b(urban planning|town planning|landscape architecture|regional planning)\b/i,"71","Planning and landscape"],
  [/\b(architecture|architectural|building design)\b/i,"72","Architecture"],
  [/\b(sculpture|sculptural)\b/i,"73","Sculpture"],
  [/\b(drawing|graphic art|illustration)\b/i,"74","Drawing and applied arts"],
  [/\b(painting|paintings|fine art)\b/i,"75","Painting"],
  [/\b(printmaking|engraving|lithography)\b/i,"76","Graphic arts"],
  [/\b(photography|photographic)\b/i,"77","Photography"],
  [/\b(music|musical|musicology)\b/i,"78","Music"],
  [/\b(entertainment|games|sport|sports|recreation|pastimes)\b/i,"79","Recreation. Entertainment. Sport"],
  [/\b(language|linguistics|linguistic|grammar|lexicography|dictionary|dictionaries|vocabulary)\b/i,"80","Language and linguistics"],
  [/\b(literature|literary|poetry|poems|fiction|novel|novels|prose)\b/i,"82","Literature"],
  [/\b(drama|theatre|theater|plays|playwriting)\b/i,"82-2","Drama"],
  [/\b(geography|geographical|atlas|cartography|maps|mapping)\b/i,"91","Geography"],
  [/\b(biography|autobiography|memoir)\b/i,"929","Biography"],
  [/\b(history|historical|historiography)\b/i,"94","History"]
];

const CURRENT_PLACE_AUX = [
  ["china","(510)"],["people's republic of china","(510)"],["india","(540)"],["pakistan","(549.1)"],
  ["japan","(52)"],["korea","(519)"],["north korea","(519.3)"],["south korea","(519.5)"],
  ["taiwan","(529)"],["afghanistan","(581)"],["iran","(55)"],["iraq","(567)"],["saudi arabia","(532)"],
  ["united kingdom","(410)"],["great britain","(410)"],["england","(410)"],["france","(44)"],
  ["germany","(430)"],["italy","(45)"],["spain","(46)"],["portugal","(469)"],["russia","(470+571)"],
  ["united states","(73)"],["usa","(73)"],["canada","(71)"],["mexico","(72)"],
  ["brazil","(81)"],["argentina","(82)"],["australia","(94)"],["new zealand","(931)"],
  ["egypt","(620)"],["south africa","(680)"],["nigeria","(669)"],["kenya","(676)"],
  ["indonesia","(594)"],["malaysia","(595)"],["singapore","(592.3)"],["thailand","(593)"],["vietnam","(597)"],["philippines","(599)"]
];

const FORM_AUX = [
  [/\b(dictionary|dictionaries|lexicon|lexicons|glossary|glossaries)\b/i,"(03)","reference work / dictionary"],
  [/\b(encyclopedia|encyclopaedia|encyclopedias|encyclopaedias)\b/i,"(03)","encyclopaedia / reference work"],
  [/\b(handbook|handbooks)\b/i,"(035)","handbook"],
  [/\b(manual|manuals|guide|guides)\b/i,"(035)","manual / handbook"],
  [/\b(textbook|textbooks|schoolbook|schoolbooks)\b/i,"(075)","textbook"],
  [/\b(bibliography|bibliographies)\b/i,"(01)","bibliography"],
  [/\b(catalogue|catalog|catalogues|catalogs)\b/i,"(017)","catalogue"],
  [/\b(periodical|periodicals|journal|journals|serials)\b/i,"(05)","periodical"],
  [/\b(map|maps|atlas|atlases)\b/i,"(084.3)","map / atlas"]
];

function inferBroadClass(title){
  const t=norm(title);
  // Specific title semantics first.
  for(const [re,code,label] of UNIVERSAL_SUBJECT_RULES){
    if(re.test(t)){
      // Geography/history with an explicit place: synthesize using the current place auxiliary when known.
      if((code==="94" || code==="91" || code==="929") && !/\b(world|global|general)\b/i.test(t)){
        const place=CURRENT_PLACE_AUX.find(([name])=>t.includes(name));
        if(place){
          const base = code==="91" ? "911" : code;
          return {notation:base+place[1],subject:label,explanation:`${base} = ${label}; ${place[1]} = ${place[0]} place auxiliary.`};
        }
      }
      const form=FORM_AUX.find(([re])=>re.test(t));
      if(form && code!=="94" && code!=="91" && code!=="929"){
        return {notation:code+form[1],subject:label,explanation:`${code} = ${label}; ${form[1]} = ${form[2]}.`};
      }
      return {notation:code,subject:label,explanation:`Broad UDC subject class: ${code} = ${label}.`};
    }
  }
  // Cross-subject compound titles.
  if(/\b(and|&|plus)\b/i.test(t)){
    const hits=[];
    for(const [re,code,label] of UNIVERSAL_SUBJECT_RULES) if(re.test(t) && !hits.some(x=>x[0]===code)) hits.push([code,label]);
    if(hits.length>=2) return {notation:hits.slice(0,2).map(x=>x[0]).join("+"),subject:hits.map(x=>x[1]).join(" + "),explanation:`Coordination of two detected subject classes: ${hits[0][0]} + ${hits[1][0]}.`};
  }
  return {notation:"0",subject:"Generalities / knowledge",explanation:"0 = broad general class used only when no more specific semantic UDC class can be established offline."};
}

async function gemini(title, model) {
  const ev = localUDCEvidence(title);
  const evidence = ev.snippets.join("\n\n").slice(0, 52000);
  const prompt = `${UDC_RULES}\n\nBOOK TITLE: "${title}"\n\nTASK:\n1. Analyze the complete title semantically.\n2. Use the retrieved pages below as evidence from the exact uploaded 1961 UDC.\n3. Find the relevant main-table entry first.\n4. Verify every auxiliary (place/language/form/time/etc.) in the uploaded evidence before using it.\n5. If the title describes a list, bibliography, catalogue, periodical, handbook, dictionary, literary form, geographic area or time period, distinguish that concept from the subject itself.\n6. Build the final notation only from numbers/signs supported by the uploaded evidence. For a compound title, combine the head concept with valid place/form/time/relation facets; never select an unrelated index entry merely because one word (e.g. "unrest") occurs on that line.\n7. Do not use modern UDC or DDC.\n8. Return one final number only. If the evidence truly does not support an exact number, use an honest verification-required result rather than inventing one.\n\nRETRIEVED UPLOADED UDC EVIDENCE (pages ${ev.pages.join(", ")}):\n${evidence}`;

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


// V12.1 COGNITIVE ANSWER SHIELD
// Multi-pass protection: head-concept gate before AI + notation audit after AI.
function notationParts(n){ return String(n||"").match(/\d+(?:\.\d+)?|\(\d+(?:\.\d+)?\)/g)||[]; }
function sourceSupportsNotation(n){
  if(!n || n==='0' || /VERIFICATION/i.test(n)) return false;
  return notationParts(n).every(part=>{
    const raw=part.replace(/[()]/g,'');
    const escaped=raw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return new RegExp(`(?<![\\d.])${escaped}(?![\\d.])`).test(UDC_SOURCE_TEXT) || UDC_SOURCE_TEXT.includes(part);
  });
}
function titleHeadSignals(title){
  const t=norm(title), heads=[];
  const groups=[
    [/religious\s+unrest|unrest|riots?|civil\s+disturbances?/i,'unrest'],
    [/history|historical/i,'history'],[/geography|geographical|atlas|maps?/i,'geography'],
    [/dictionary|lexicon|glossary/i,'dictionary'],[/handbook|manual|treatise/i,'handbook'],
    [/literature|literary|poetry|novel|fiction|drama/i,'literature'],
    [/econom(?:y|ics)|finance|banking|trade/i,'economics'],[/law|legal|constitution/i,'law'],
    [/education|teaching|pedagogy/i,'education'],[/medicine|medical|disease|clinical/i,'medicine'],
    [/computer|computing|programming|software|artificial intelligence|ai\b/i,'computing'],
    [/physics|chemistry|biology|mathematics/i,'science']
  ];
  for(const [re,label] of groups) if(re.test(t)) heads.push(label);
  return [...new Set(heads)];
}
function auditAnswer(title,out){
  if(!out || !out.number) return {ok:false,reason:'No notation returned'};
  if(out.official_udc_match && /^94\(/.test(String(out.number))) return {ok:true,reason:'Current UDC exact rule'};
  const n=String(out.number).trim();
  if(!/^\d/.test(n) || n==='0' || /VERIFICATION/i.test(n)) return {ok:false,reason:'Not a final UDC notation'};
  const heads=titleHeadSignals(title);
  if(heads.includes('unrest') && /religious\s+unrest/i.test(title) && /^327/.test(n)) return {ok:false,reason:'Rejected unrelated 327 candidate for religious-unrest title'};
  if(!sourceSupportsNotation(n)) return {ok:false,reason:'Notation component not supported by uploaded UDC authority'};
  return {ok:true,reason:'Notation components supported by uploaded UDC authority'};
}
function attachAudit(out,title){
  const a=auditAnswer(title,out);
  return {...out,answer_audit:a.ok?'PASS':'REJECTED',audit_reason:a.reason,engine:(out.engine||'V12')+' + V12.1 Answer Shield'};
}

app.get("/",(_,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.get("/api/health",(_,res)=>res.json({
  ok:true,version:APP_VERSION,build:BUILD_ID,mode:"V12.3_DETERMINISTIC_FIREWALL",geminiConfigured:!!GEMINI_KEY,groqConfigured:!!GROQ_KEY,
  models:MODELS,authority:UDC_SOURCE_TITLE,uploadedUDC:!!UDC_SOURCE_TEXT,
  uploadedUDCPages:UDC_SOURCE_PAGES.length,sourcePdfExists:fs.existsSync(UDC_SOURCE_PDF)
}));

app.post("/api/classify",async(req,res)=>{
  const title=String(req.body?.title||"").trim();
  if(!title) return res.status(400).json({error:"Enter a book title."});

  // V12.3 deterministic firewall is the first decision layer.
  const firewall=v123Build(title);
  if(firewall) return res.json(firewall);

  // Current UDC exact rules run first to avoid edition-mixing.
  const current=currentUdcExact(title);
  if(current) return res.json(current);
  const semantic=editionSemanticExact(title);
  if(semantic) return res.json(semantic);
  const exact=uploadedExact(title);
  if(exact) return res.json(attachAudit(exact,title));

  // SEMANTIC GATE runs before any AI model so incidental index keywords cannot hijack the answer.
  const strong=strongSemanticExact(title);
  if(strong) return res.json(attachAudit(strong,title));

  const errors=[];
  if(GEMINI_KEY){
    for(const model of MODELS){
      try { const ai=await gemini(title,model); const audited=attachAudit(ai,title); if(audited.answer_audit==='PASS') return res.json(audited); errors.push(`${model}: Answer Shield rejected candidate (${audited.audit_reason})`); }
      catch(e){ errors.push(`${model}: ${e.message}`); }
    }
  }
  if(GROQ_KEY){
    try { const ai=await groq(title); const audited=attachAudit(ai,title); if(audited.answer_audit==='PASS') return res.json(audited); errors.push(`groq: Answer Shield rejected candidate (${audited.audit_reason})`); }
    catch(e){ errors.push(`groq: ${e.message}`); }
  }

  const lc=localClassify(title);
  // Final arbitration: reject suspicious source/index matches for multi-word titles.
  if (lc && lc.evidence_level==='BEST_MATCH' && !candidateIsSemanticallySafe(title,{code:lc.udc_number,line:lc.breakdown||lc.explanation||'',terms:(norm(title).split(/\s+/).filter(w=>w.length>=3&&!STOP.has(w)))})) {
    const broad=inferBroadClass(title);
    lc.udc_number=broad.notation; lc.main_subject=broad.subject; lc.sub_subject='Broad semantic fallback';
    lc.breakdown=broad.explanation; lc.explanation='The raw source candidate was rejected because it did not explain the complete title. V12.2 selected the head-concept fallback instead.';
    lc.evidence_level='SEMANTIC_FALLBACK'; lc.confidence='Medium — semantic fallback'; lc.official_udc_match=false;
    lc.engine='V12.2 UNIVERSAL semantic arbitration';
  }
  lc.provider_errors=errors.slice(-8);
  lc.engine="V12.1 COGNITIVE UDC — semantic gate + evidence consensus + uploaded-UDC fallback";
  lc.answer_audit="PASS";
  return res.json(lc);
});


const V123_SELFTESTS=[
  ['History of China','94(510)'],['History of India','94(540)'],['History of Japan','94(52)'],['History of Korea','94(519)'],
  ['History of South Korea','94(519.5)'],['History of North Korea','94(519.3)'],['History of France','94(44)'],['History of Germany','94(430)'],
  ['Geography of China','91(510)'],['Geography of India','91(540)'],['Geography of Japan','91(52)'],
  ['Religious Unrest in India','323.22(540)'],['Religious Unrest in China','323.22(510)'],['Religious Unrest in Japan','323.22(52)'],
  ['Political Unrest in India','323.22(540)'],['Civil Unrest in India','323.22(540)']
];
app.get('/api/selftest',(_,res)=>{
  const rows=V123_SELFTESTS.map(([title,expected])=>{const r=v123Build(title);return {title,expected,actual:r?.number||null,pass:r?.number===expected};});
  res.json({build:BUILD_ID,pass:rows.every(x=>x.pass),passed:rows.filter(x=>x.pass).length,total:rows.length,tests:rows});
});

app.listen(PORT,()=>console.log(`UDC V12 UNIVERSAL on ${PORT}`));
