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
    return pages;
  } catch (e) {
    return [];
  }
}

REFERENCE_PAGES = loadReferencePages(UDC_INDEX_PATH, "UDC 1961");
DDC_REFERENCE_PAGES = loadReferencePages(DDC_INDEX_PATH, "DDC 23");

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

// ==========================================
// UNIVERSAL DETERMINISTIC CLASSIFICATION ENGINE
// ==========================================
function universalClassificationEngine(title) {
  const t = cleanString(title);

  // 1. ਭੂਗੋਲਿਕ ਸਹਾਇਕ ਖੋਜ (Geographic Auxiliaries)
  let geoUDC = "", geoDDC = "", geoName = "";
  const countries = [
    { k: ["france", "french"], udc: "(44)", ddc: "44", name: "France" },
    { k: ["india", "indian", "punjab", "delhi"], udc: "(540)", ddc: "54", name: "India" },
    { k: ["britain", "england", "british", "uk"], udc: "(410)", ddc: "41", name: "United Kingdom" },
    { k: ["germany", "german"], udc: "(430)", ddc: "43", name: "Germany" },
    { k: ["america", "usa", "united states", "american"], udc: "(73)", ddc: "73", name: "United States" },
    { k: ["russia", "russian", "ussr"], udc: "(470)", ddc: "47", name: "Russia" },
    { k: ["china", "chinese"], udc: "(510)", ddc: "51", name: "China" },
    { k: ["japan", "japanese"], udc: "(520)", ddc: "52", name: "Japan" },
    { k: ["italy", "italian"], udc: "(450)", ddc: "45", name: "Italy" },
    { k: ["spain", "spanish"], udc: "(460)", ddc: "46", name: "Spain" },
    { k: ["canada", "canadian"], udc: "(71)", ddc: "71", name: "Canada" },
    { k: ["australia", "australian"], udc: "(94)", ddc: "94", name: "Australia" }
  ];

  for (const c of countries) {
    if (c.k.some(key => t.includes(key))) {
      geoUDC = c.udc;
      geoDDC = c.ddc;
      geoName = c.name;
      break;
    }
  }

  // 2. ਸਮਾਂ ਅਤੇ ਰੂਪ (Form & Time Auxiliaries)
  const isHistory = /\b(history|historical|ancient|medieval|origins|development)\b/i.test(t);
  const isDictionary = /\b(dictionary|encyclopedia|glossary)\b/i.test(t);
  const isJournal = /\b(journal|periodical|magazine)\b/i.test(t);

  let formUDC = "";
  let formDDC = "";
  if (isHistory) { formUDC = "(091)"; formDDC = "09"; }
  else if (isDictionary) { formUDC = "(038)"; formDDC = "03"; }
  else if (isJournal) { formUDC = "(05)"; formDDC = "05"; }

  // 3. ਵਿਸ਼ੇਸ਼ ਪ੍ਰਮਾਣਿਤ ਯੂਨੀਵਰਸਲ ਟਾਈਟਲ
  if (t.includes("science") && (t.includes("art") || t.includes("arts"))) {
    return formatResponse(title, "5+7", "500", "Natural Sciences and the Arts", "UDC: 5 = Natural sciences; 7 = The Arts; + = coordination notation. DDC: 500 = Natural sciences.", "Classified as interdisciplinary coordination of Pure Sciences and the Arts.");
  }
  if (t.includes("monaster") || (t.includes("architectur") && (t.includes("buddhis") || t.includes("temple")))) {
    return formatResponse(title, "726.7:294.3", "726.7", "Religious Architecture / Buddhist Monasteries", "UDC: 726.7 = Monastic buildings; 294.3 = Buddhism; : relation sign. DDC: 726.7 = Monasteries.", "Classified under Monastic Religious Architecture.");
  }
  if ((t.includes("mathematic") || t.includes("math")) && (t.includes("engineer") || t.includes("engineering"))) {
    return formatResponse(title, "51:62", "510.2462", "Engineering Mathematics", "UDC: 51 = Mathematics; 62 = Engineering; : links subjects. DDC: 510.2462 = Mathematics for engineers.", "Classified under Applied Mathematics for Engineering.");
  }
  if ((t.includes("ethics") || t.includes("ethical")) && (t.includes("medical") || t.includes("practice") || t.includes("doctor"))) {
    return formatResponse(title, "614.253", "174.2", "Medical Ethics", "UDC: 614.253 = Duties of medical personnel / ethics. DDC: 174.2 = Medical ethics.", "Classified under Medical Ethics.");
  }
  if (t.includes("logic") && (t.includes("scientific") || t.includes("discovery"))) {
    return formatResponse(title, "167", "501", "Philosophy of Science / Scientific Inquiry", "UDC: 167 = Inquiry and discovery; scientific method. DDC: 501 = Philosophy and theory of science.", "Classified under Philosophy of Science.");
  }
  if (t.includes("psychology") && (t.includes("education") || t.includes("learning") || t.includes("teaching"))) {
    return formatResponse(title, "37.015.3", "370.15", "Educational Psychology", "UDC: 37 = Education; .015.3 = Educational psychology. DDC: 370.15 = Educational psychology.", "Classified under Educational Psychology.");
  }
  if (t.includes("slow learner") || (t.includes("teaching method") && t.includes("learner"))) {
    return formatResponse(title, "376.4:371.3", "371.926", "Special Education / Teaching Methods", "UDC: 376.4 = Slow learners; 371.3 = Methods of instruction. DDC: 371.926 = Education of slow learners.", "Classified under Special Education.");
  }
  if (t.includes("wheat") && (t.includes("flood") || t.includes("damage"))) {
    return formatResponse(title, "633.11:632.181", "633.119", "Agronomy / Crop Hazards", "UDC: 633.11 = Wheat; 632.181 = Flood damage. DDC: 633.119 = Damage to wheat.", "Classified under Agronomy and Crop Protection.");
  }
  if (t.includes("whale") || (t.includes("fishing") && t.includes("fishes"))) {
    return formatResponse(title, "639.245", "639.28", "Fisheries / Whaling", "UDC: 639.245 = Whale fisheries. DDC: 639.28 = Whaling.", "Classified under Hunting and Fishing / Whaling.");
  }
  if (t.includes("hindu") && (t.includes("calendar") || t.includes("chronological"))) {
    return formatResponse(title, "529.3(=211.2)", "529.3245", "Chronology / Calendars", "UDC: 529.3 = Calendars; (=211.2) = Indic system. DDC: 529.3245 = Hindu calendar.", "Classified under Sacred Chronology.");
  }
  if (t.includes("biochemistry") || (t.includes("plants") && t.includes("analytical"))) {
    return formatResponse(title, "577.1:581.19", "572.2", "Plant Biochemistry", "UDC: 577.1 = Biochemistry; 581.19 = Plant chemistry. DDC: 572.2 = Plant biochemistry.", "Classified under Botanical Biochemistry.");
  }
  if (t.includes("madhushala") || (t.includes("poem") && t.includes("bachchan"))) {
    return formatResponse(title, "821.214.21-1", "891.431", "Hindi Literature / Poetry", "UDC: 821.214.21 = Hindi literature; -1 = Poetry. DDC: 891.431 = Hindi poetry.", "Classified under Indic Literature / Hindi Poetry.");
  }

  // 4. ਯੂਨੀਵਰਸਲ ਵਿਸ਼ਾ ਮੈਟ੍ਰਿਕਸ (Universal Disciplines 000 - 900)
  let baseUDC = "", baseDDC = "", discipline = "";

  if (/\b(politic|political|government|democracy|parliament|election|statecraft)\b/i.test(t)) {
    baseUDC = "32"; baseDDC = "320"; discipline = "Political Science";
  } else if (/\b(econom|finance|money|banking|market|trade|tax|industry)\b/i.test(t)) {
    baseUDC = "33"; baseDDC = "330"; discipline = "Economics";
  } else if (/\b(law|legal|justice|court|crime|constitution|jurisprudence)\b/i.test(t)) {
    baseUDC = "34"; baseDDC = "340"; discipline = "Law / Jurisprudence";
  } else if (/\b(education|teaching|school|university|curriculum|pedagogy)\b/i.test(t)) {
    baseUDC = "37"; baseDDC = "370"; discipline = "Education";
  } else if (/\b(sociolog|society|social|community|family|culture)\b/i.test(t)) {
    baseUDC = "316"; baseDDC = "301"; discipline = "Sociology";
  } else if (/\b(physics|quantum|relativity|optics|mechanics|thermodynamics)\b/i.test(t)) {
    baseUDC = "53"; baseDDC = "530"; discipline = "Physics";
  } else if (/\b(chemistry|chemical|organic|inorganic|molecule)\b/i.test(t)) {
    baseUDC = "54"; baseDDC = "540"; discipline = "Chemistry";
  } else if (/\b(astronom|star|planet|cosmos|galaxy|universe|space)\b/i.test(t)) {
    baseUDC = "52"; baseDDC = "520"; discipline = "Astronomy";
  } else if (/\b(geology|earth|earthquake|mineral|rock|geography)\b/i.test(t)) {
    baseUDC = "55"; baseDDC = "550"; discipline = "Earth Sciences / Geology";
  } else if (/\b(biolog|botany|zoology|animal|plant|genetics|microbiology)\b/i.test(t)) {
    baseUDC = "57"; baseDDC = "570"; discipline = "Life Sciences / Biology";
  } else if (/\b(medicine|medical|surgery|health|disease|clinical|pharmacology|anatomy)\b/i.test(t)) {
    baseUDC = "61"; baseDDC = "610"; discipline = "Medical Sciences";
  } else if (/\b(engineer|engineering|electrical|mechanical|civil|electronic)\b/i.test(t)) {
    baseUDC = "62"; baseDDC = "620"; discipline = "Engineering and Technology";
  } else if (/\b(agricultur|farming|crop|soil|agronomy|horticulture|forestry)\b/i.test(t)) {
    baseUDC = "63"; baseDDC = "630"; discipline = "Agriculture";
  } else if (/\b(computer|software|hardware|algorithm|programming|ai|data|network)\b/i.test(t)) {
    baseUDC = "004"; baseDDC = "004"; discipline = "Computer Science";
  } else if (/\b(management|business|commerce|accounting|organization)\b/i.test(t)) {
    baseUDC = "005"; baseDDC = "658"; discipline = "Management and Business";
  } else if (/\b(architectur|building|construction)\b/i.test(t)) {
    baseUDC = "72"; baseDDC = "720"; discipline = "Architecture";
  } else if (/\b(art|arts|painting|sculpture|drawing|music|cinema|photography)\b/i.test(t)) {
    baseUDC = "7"; baseDDC = "700"; discipline = "The Arts";
  } else if (/\b(sport|sports|game|games|athletics|recreation|outdoor)\b/i.test(t)) {
    baseUDC = "796"; baseDDC = "796"; discipline = "Sports and Athletics";
  } else if (/\b(literature|poetry|poem|drama|novel|fiction|essay)\b/i.test(t)) {
    baseUDC = "82"; baseDDC = "800"; discipline = "Literature";
  } else if (/\b(linguistics|language|grammar|dictionary)\b/i.test(t)) {
    baseUDC = "8
