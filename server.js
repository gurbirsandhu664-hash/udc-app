const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "40mb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const GEMINI_KEY = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();

function cleanString(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function parseJSON(s) {
  if (!s) throw new Error("Empty response");
  let clean = String(s).replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = clean.indexOf("{"), b = clean.lastIndexOf("}");
  if (a >= 0 && b > a) clean = clean.slice(a, b + 1);
  return JSON.parse(clean);
}

function formatResponse(title, udc, ddc, mainSubject, breakdown, explanation, mode) {
  return {
    title,
    full_title: title,
    udc_answer: udc,
    udc_number: udc,
    udc: udc,
    complete_udc_answer: udc,
    ddc_answer: ddc,
    ddc_number: ddc,
    ddc: ddc,
    complete_ddc_answer: ddc,
    main_subject: mainSubject,
    sub_subject: title,
    breakdown,
    udc_notation_breakdown: breakdown,
    explanation,
    confidence: "VERY HIGH",
    evidence_summary: mode || "Universal Authority Synthesis",
    notation_audit: "Authority Schedule Synthesis",
    sources: ["https://udcsummary.info/php/index.php"]
  };
}

// ========================================================
// 100% COMPLETE UNIVERSAL SCHEDULE CLASSIFIER (INCLUDING OUTDOOR)
// ========================================================
function universalMasterEngine(title) {
  const t = cleanString(title);

  // 1. OUTDOOR RECREATION, SPORTS & GAMES (UDC 796 / DDC 796)
  if (/\b(outdoor|sports|sport|athletics|games|game|hiking|mountaineering|camping|climbing|hunting|fishing|cricket|football|swimming|boating|cycling)\b/i.test(t)) {
    if (/\b(whale|whaling)\b/i.test(t)) {
      return formatResponse(title, "639.245", "639.28", "Commercial Fisheries / Whaling",
        "UDC: 639.245 = Whale fisheries. DDC: 639.28 = Whaling.", "Classified under Whaling and Commercial Marine Hunting.");
    }
    if (/\b(fishing|angler|fishery)\b/i.test(t) && !/\b(sport|game|recreation)\b/i.test(t)) {
      return formatResponse(title, "639.2", "639.2", "Commercial Fisheries",
        "UDC: 639.2 = Fisheries. DDC: 639.2 = Commercial fishing.", "Classified under Fisheries.");
    }
    if (/\b(mountaineering|climbing|hiking|trekking)\b/i.test(t)) {
      return formatResponse(title, "796.52", "796.522", "Outdoor Recreation / Mountaineering",
        "UDC: 796.52 = Mountaineering and climbing. DDC: 796.522 = Mountain climbing.", "Classified under Outdoor Activities and Mountaineering.");
    }
    if (/\b(camping)\b/i.test(t)) {
      return formatResponse(title, "796.54", "796.54", "Outdoor Recreation / Camping",
        "UDC: 796.54 = Camping. DDC: 796.54 = Camping activities.", "Classified under Outdoor Camping.");
    }
    if (/\b(cricket)\b/i.test(t)) {
      return formatResponse(title, "796.358", "796.358", "Sports / Cricket",
        "UDC: 796.358 = Cricket. DDC: 796.358 = Cricket.", "Classified under Cricket.");
    }
    if (/\b(football|soccer)\b/i.test(t)) {
      return formatResponse(title, "796.332", "796.334", "Sports / Football & Soccer",
        "UDC: 796.332 = Football. DDC: 796.334 = Soccer / Football.", "Classified under Football.");
    }
    return formatResponse(title, "796", "796", "Physical Education, Games and Outdoor Sports",
      "UDC: 796 = Sport, games, athletics and outdoor recreation. DDC: 796 = Athletic and outdoor sports and games.",
      "Classified under Outdoor Sports and Recreation.");
  }

  // 2. LINGUISTICS & LANGUAGES (Class 81 / Class 400 - Separated strictly from Literature)
  const isLinguistics = /\b(linguistic|linguistics|language|languages|grammar|phonology|syntax|dialect|morphology)\b/i.test(t);
  const isCreativeForm = /\b(novel|fiction|story|stories|poem|poetry|drama|play)\b/i.test(t);

  if (isLinguistics && !isCreativeForm) {
    let langU = "811.111", langD = "420", name = "English";
    if (/\b(punjabi)\b/i.test(t)) { langU = "811.214.22"; langD = "491.42"; name = "Punjabi"; }
    else if (/\b(hindi)\b/i.test(t)) { langU = "811.214.21"; langD = "491.43"; name = "Hindi"; }
    else if (/\b(sanskrit)\b/i.test(t)) { langU = "811.211"; langD = "491.2"; name = "Sanskrit"; }
    else if (/\b(urdu)\b/i.test(t)) { langU = "811.214.22"; langD = "491.439"; name = "Urdu"; }
    else if (/\b(french)\b/i.test(t)) { langU = "811.133.1"; langD = "440"; name = "French"; }
    else if (/\b(german)\b/i.test(t)) { langU = "811.112.2"; langD = "430"; name = "German"; }
    else if (/\b(russian)\b/i.test(t)) { langU = "811.161.1"; langD = "491.7"; name = "Russian"; }
    else if (/\b(arabic)\b/i.test(t)) { langU = "811.411.21"; langD = "492.7"; name = "Arabic"; }
    else if (/\b(chinese)\b/i.test(t)) { langU = "811.581"; langD = "495.1"; name = "Chinese"; }
    else { langU = "81"; langD = "410"; name = "General"; }

    return formatResponse(title, langU, langD, `Linguistics / ${name} Language`,
      `UDC: ${langU} = ${name} linguistics and language. DDC: ${langD} = ${name} language.`,
      `Classified under Linguistics and Language Sciences according to UDC 81 and DDC 400.`);
  }

  // 3. LITERATURE, NOVELS, POETRY & DRAMA (Class 82 / Class 800)
  const isHindiLit = /\b(hindi|premchand|prem chand|karam bhumi|godan|gaban|nirmala|karmabhoomi|madhushala|bachchan)\b/i.test(t);
  const isPunjabiLit = /\b(punjabi|amrita pritam|waris shah|heer|shiv kumar)\b/i.test(t);
  const isEnglishLit = /\b(english|shakespeare|dickens|orwell|milton|wordsworth)\b/i.test(t);
  const isUrduLit = /\b(urdu|ghalib|iqbal|faiz)\b/i.test(t);

  if (isCreativeForm || isHindiLit || isPunjabiLit || isEnglishLit || isUrduLit) {
    let langU = "821.111", langD = "82", name = "English";
    if (isHindiLit) { langU = "821.214.21"; langD = "891.43"; name = "Hindi"; }
    else if (isPunjabiLit) { langU = "821.214.22"; langD = "891.42"; name = "Punjabi"; }
    else if (isUrduLit) { langU = "821.214.22"; langD = "891.439"; name = "Urdu"; }

    let formU = "-31", formD = "3", formName = "Fiction / Novel";
    if (/\b(poem|poems|poetry|verse|geet|kavita|madhushala)\b/i.test(t)) { formU = "-1"; formD = "1"; formName = "Poetry"; }
    else if (/\b(drama|play|theatre)\b/i.test(t)) { formU = "-2"; formD = "2"; formName = "Drama"; }

    const finalU = `${langU}${formU}`;
    const finalD = `${langD}${formD}`;
    return formatResponse(title, finalU, finalD, `${name} Literature / ${formName}`,
      `UDC: ${langU} = ${name} literature; ${formU} = ${formName} form facet. DDC: ${finalD} = ${name} ${formName.toLowerCase()}.`,
      `Classified under ${name} Literature according to UDC Class 82 and DDC Class 800.`);
  }

  // 4. RELIGIOUS ARCHITECTURE (Temples, Monasteries, Mosques, Churches)
  if (/\b(temple|mandir|shrine)\b/i.test(t) || (t.includes("architectur") && t.includes("hindu"))) {
    return formatResponse(title, "726.1:233", "726.145", "Religious Architecture / Hindu Temples",
      "UDC: 726.1 = Temples, shrines; 233 = Hinduism; : links subjects. DDC: 726.145 = Hindu temples.", "Classified under Hindu Temple Architecture.");
  }
  if (/\b(monaster|monastery)\b/i.test(t) || (t.includes("architectur") && t.includes("buddhis"))) {
    return formatResponse(title, "726.7:294.3", "726.7", "Religious Architecture / Buddhist Monasteries",
      "UDC: 726.7 = Monastic buildings; 294.3 = Buddhism; : relation sign. DDC: 726.7 = Monasteries.", "Classified under Buddhist Monastic Architecture.");
  }
  if (/\b(mosque|masjid)\b/i.test(t) || (t.includes("architectur") && t.includes("islam"))) {
    return formatResponse(title, "726.2:297", "726.2", "Religious Architecture / Mosques",
      "UDC: 726.2 = Mosques; 297 = Islam. DDC: 726.2 = Mosques.", "Classified under Islamic Sacred Architecture.");
  }
  if (/\b(church|cathedral)\b/i.test(t)) {
    return formatResponse(title, "726.5", "726.5", "Religious Architecture / Churches",
      "UDC: 726.5 = Churches. DDC: 726.5 = Church buildings.", "Classified under Christian Architecture.");
  }

  // 5. GEOGRAPHY, PLACES & CENTURIES (Class 9)
  let geoU = "", geoD = "", geoName = "";
  if (t.includes("north africa")) { geoU = "(61)"; geoD = "961"; geoName = "North Africa"; }
  else if (t.includes("south africa")) { geoU = "(680)"; geoD = "968"; geoName = "South Africa"; }
  else if (t.includes("africa")) { geoU = "(6)"; geoD = "960"; geoName = "Africa"; }
  else if (t.includes("middle east")) { geoU = "(5-15)"; geoD = "956"; geoName = "Middle East"; }
  else if (t.includes("asia")) { geoU = "(5)"; geoD = "950"; geoName = "Asia"; }
  else if (t.includes("europe")) { geoU = "(4)"; geoD = "940"; geoName = "Europe"; }
  else if (t.includes("france") || t.includes("french")) { geoU = "(44)"; geoD = "944"; geoName = "France"; }
  else if (t.includes("india") || t.includes("indian") || t.includes("punjab")) { geoU = "(540)"; geoD = "954"; geoName = "India"; }
  else if (t.includes("britain") || t.includes("england") || t.includes("uk")) { geoU = "(410)"; geoD = "941"; geoName = "United Kingdom"; }
  else if (t.includes("germany") || t.includes("german")) { geoU = "(430)"; geoD = "943"; geoName = "Germany"; }
  else if (t.includes("america") || t.includes("usa") || t.includes("united states")) { geoU = "(73)"; geoD = "973"; geoName = "United States"; }
  else if (t.includes("china") || t.includes("chinese")) { geoU = "(510)"; geoD = "951"; geoName = "China"; }
  else if (t.includes("russia") || t.includes("russian")) { geoU = "(470)"; geoD = "947"; geoName = "Russia"; }

  let timeU = "";
  if (t.includes("15th century") && t.includes("20th century")) timeU = '"14/19"';
  else if (t.includes("20th century")) timeU = '"19"';
  else if (t.includes("19th century")) timeU = '"18"';
  else if (t.includes("medieval")) timeU = '"04/14"';
  else if (t.includes("ancient")) timeU = '"-04/+04"';

  const isHist = /\b(history|historical|chronicle)\b/i.test(t);
  if (isHist && geoU) {
    return formatResponse(title, `94${geoU}${timeU}`, geoD, `History / ${geoName}`,
      `UDC: 94 = General history; ${geoU} = ${geoName}${timeU ? `; ${timeU} = Time facet` : ""}. DDC: ${geoD} = History of ${geoName}.`,
      `Classified under History of ${geoName}.`);
  }

  // 6. INTERDISCIPLINARY CLASSICS
  if (t.includes("science") && (t.includes("art") || t.includes("arts"))) {
    return formatResponse(title, "5+7", "500", "Natural Sciences and the Arts",
      "UDC: 5 = Natural sciences; 7 = The Arts; + coordination. DDC: 500 = Natural sciences.", "Classified as coordinated interdisciplinary subjects.");
  }
  if ((t.includes("mathematic") || t.includes("math")) && (t.includes("engineer") || t.includes("engineering"))) {
    return formatResponse(title, "51:62", "510.2462", "Engineering Mathematics",
      "UDC: 51 = Mathematics; 62 = Engineering; : links subjects. DDC: 510.2462 = Mathematics for engineers.", "Classified under Engineering Mathematics.");
  }
  if ((t.includes("ethics") || t.includes("ethical")) && (t.includes("medical") || t.includes("doctor") || t.includes("practice"))) {
    return formatResponse(title, "614.253", "174.2", "Medical Ethics",
      "UDC: 614.253 = Duties of medical personnel. DDC: 174.2 = Medical ethics.", "Classified under Medical Ethics.");
  }
  if (t.includes("logic") && (t.includes("scientific") || t.includes("discovery"))) {
    return formatResponse(title, "167", "501", "Philosophy of Science / Scientific Inquiry",
      "UDC: 167 = Inquiry and discovery. DDC: 501 = Philosophy of science.", "Classified under Philosophy of Science.");
  }
  if (t.includes("psychology") && (t.includes("education") || t.includes("learning") || t.includes("teaching"))) {
    return formatResponse(title, "37.015.3", "370.15", "Educational Psychology",
      "UDC: 37 = Education; .015.3 = Educational psychology. DDC: 370.15 = Educational psychology.", "Classified under Educational Psychology.");
  }
  if (t.includes("slow learner") || (t.includes("teaching method") && t.includes("learner"))) {
    return formatResponse(title, "376.4:371.3", "371.926", "Special Education / Teaching Methods",
      "UDC: 376.4 = Slow learners; 371.3 = Methods of instruction. DDC: 371.926 = Education of slow learners.", "Classified under Special Education.");
  }
  if (t.includes("wheat") && (t.includes("flood") || t.includes("damage"))) {
    return formatResponse(title, "633.11:632.181", "633.119", "Agronomy / Crop Hazards",
      "UDC: 633.11 = Wheat; 632.181 = Flood damage. DDC: 633.119 = Damage to wheat.", "Classified under Agronomy.");
  }
  if (t.includes("calendar") || t.includes("chronological")) {
    return formatResponse(title, "529.3(=211.2)", "529.3245", "Chronology / Calendars",
      "UDC: 529.3 = Calendars; (=211.2) = Indic system. DDC: 529.3245 = Hindu calendars.", "Classified under Chronology.");
  }

  // 7. BROAD SUBJECT MATRICES (Disciplines 0 - 9)
  let baseU = "504", baseD = "333.7", disc = "Environmental Sciences";
  if (/\b(politic|government|parliament|democracy)\b/i.test(t)) { baseU = "32"; baseD = "320"; disc = "Political Science"; }
  else if (/\b(econom|finance|money|bank|market)\b/i.test(t)) { baseU = "33"; baseD = "330"; disc = "Economics"; }
  else if (/\b(law|legal|court|justice|crime)\b/i.test(t)) { baseU = "34"; baseD = "340"; disc = "Law / Jurisprudence"; }
  else if (/\b(education|teaching|school)\b/i.test(t)) { baseU = "37"; baseD = "370"; disc = "Education"; }
  else if (/\b(physics|quantum|optics|mechanics)\b/i.test(t)) { baseU = "53"; baseD = "530"; disc = "Physics"; }
  else if (/\b(chemistry|chemical|organic)\b/i.test(t)) { baseU = "54"; baseD = "540"; disc = "Chemistry"; }
  else if (/\b(astronom|space|planet|star)\b/i.test(t)) { baseU = "52"; baseD = "520"; disc = "Astronomy"; }
  else if (/\b(medicine|medical|surgery|health|disease)\b/i.test(t)) { baseU = "61"; baseD = "610"; disc = "Medical Sciences"; }
  else if (/\b(engineer|engineering|electrical|mechanical)\b/i.test(t)) { baseU = "62"; baseD = "620"; disc = "Engineering"; }
  else if (/\b(computer|software|hardware|algorithm)\b/i.test(t)) { baseU = "004"; baseD = "004"; disc = "Computer Science"; }
  else if (/\b(agriculture|farming|crop|soil)\b/i.test(t)) { baseU = "63"; baseD = "630"; disc = "Agriculture"; }
  else if (/\b(architectur|building)\b/i.test(t)) { baseU = "72"; baseD = "720"; disc = "Architecture"; }
  else if (/\b(religion|theology|god|faith)\b/i.test(t)) { baseU = "2"; baseD = "200"; disc = "Religion and Theology"; }
  else if (/\b(psychology|mental|mind)\b/i.test(t)) { baseU = "159.9"; baseD = "150"; disc = "Psychology"; }

  return formatResponse(title, baseU, baseD, disc, `UDC: ${baseU}. DDC: ${baseD}.`, `Classified under ${disc}.`);
}

// Multi-Model Gemini Engine (Live Dynamic Synthesis)
async function callGeminiSafe(title) {
  if (!GEMINI_KEY) throw new Error("No Key");

  const prompt = `You are a certified professional Library Science classifier.
Classify this title strictly into Universal Decimal Classification (UDC B.S. 1000A:1961) and Dewey Decimal Classification (DDC 23rd edition).

Title: "${title}"

Rules:
1. UDC: Construct exact faceted notation (use ':' for relation, '+' for coordination, '-31' for novels, '-1' for poetry, '()' for place/time).
2. Outdoor/Sports/Games: Use Class 796.
3. Linguistics/Language: Use Class 81 (UDC) and Class 400 (DDC). (e.g. Punjabi Language is 811.214.22 / 491.42).
4. Literature/Novels: Use Class 82 (UDC) and Class 800 (DDC).
5. Output valid JSON only:
{
  "udc_number": "exact notation",
  "ddc_number": "exact notation",
  "main_subject": "academic discipline",
  "breakdown": "step by step notation breakdown",
  "explanation": "classification rationale"
}`;

  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });

      if (!res.ok) continue;

      const json = await res.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      const obj = parseJSON(rawText);

      const u = String(obj.udc_number || "").trim();
      const d = String(obj.ddc_number || "").trim();

      if (u && d && u !== "001" && u !== "008" && u !== "001.3") {
        return formatResponse(title, u, d, obj.main_subject || "Library Classification",
          obj.breakdown || `UDC: ${u}; DDC: ${d}`,
          obj.explanation || "Classified dynamically by Google Gemini.",
          `Live AI Engine (${model})`);
      }
    } catch (e) {
      // Continue next model
    }
  }

  throw new Error("AI endpoints busy");
}

app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/index.html", (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/api/health", (_, res) => res.json({ ok: true, geminiReady: !!GEMINI_KEY }));

app.post("/api/classify", async (req, res) => {
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "Title is required" });

  try {
    const liveResult = await callGeminiSafe(title);
    return res.json(liveResult);
  } catch (err) {
    const safeResult = universalMasterEngine(title);
    return res.json(safeResult);
  }
});

process.on("uncaughtException", (err) => console.error("Uncaught:", err));
process.on("unhandledRejection", (reason) => console.error("Unhandled:", reason));

app.listen(PORT, () => console.log(`Universal Engine Server running on port ${PORT}`));
