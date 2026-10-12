const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

function loadJsonSafe(filename) {
    const p = path.join(__dirname, filename);
    if (fs.existsSync(p)) {
        try {
            return JSON.parse(fs.readFileSync(p, 'utf8'));
        } catch (e) {
            console.error(`Error loading ${filename}:`, e.message);
            return {};
        }
    }
    return {};
}

const udcIndex = loadJsonSafe('udc-1961-reference-index.json');
const ddcIndex = loadJsonSafe('ddc-23-reference-index.json');

function cleanTokens(str) {
    return (str || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// -------------------------------------------------------------
// 1. FORMS & AUXILIARIES (BIOGRAPHY, SPEECHES, REPORTS, ETC.)
// -------------------------------------------------------------
function getFormAuxiliary(text) {
    let formUdc = "";
    let formDdc = "";
    let isBiography = false;
    let notes = [];

    // Biography / Life / Memoirs
    if (/\b(life\s*and|biography|biographies|autobiography|memoirs?|life\s*of|lives\s*of)\b/i.test(text)) {
        isBiography = true;
        formUdc = "(092)";
        formDdc = ".092";
        notes.push("UDC (092) = Biographical form auxiliary / 929; DDC .092 (Biography)");
    } else if (/\b(speeches|addresses|lectures|orations?)\b/i.test(text)) {
        formUdc = "(042)";
        formDdc = ".04";
        notes.push("UDC (042) = Speeches, lectures, addresses; DDC Table 1 .04");
    } else if (/\b(annual\s*reports?|progress\s*reports?|reports?)\b/i.test(text)) {
        formUdc = "(047)";
        formDdc = ".06";
        notes.push("UDC (047) = Reports / Accounts; DDC .06");
    } else if (/\b(directories|directory|yearbooks?)\b/i.test(text)) {
        formUdc = "(058)";
        formDdc = ".025";
        notes.push("UDC (058) = Directories; DDC .025");
    } else if (/\b(handbooks?|manuals?|guides?)\b/i.test(text)) {
        formUdc = "(02)";
        formDdc = ".02";
        notes.push("UDC (02) = Handbooks; DDC .02");
    } else if (/\b(bibliographies|bibliography)\b/i.test(text)) {
        formUdc = "(01)";
        formDdc = "016";
        notes.push("UDC (01) = Bibliographies");
    }

    return { formUdc, formDdc, isBiography, notes };
}

// -------------------------------------------------------------
// 2. PLACE & CORPORATE BODIES
// -------------------------------------------------------------
function getPlaceAndOrg(text) {
    let placeUdc = "";
    let ddcPlace = "";
    let orgRel = "";
    let notes = [];

    if (/\b(institutes?|institutions?|organisations?|organizations?|associations?|societies|society|academies|academy|boards?|councils?)\b/i.test(text)) {
        orgRel = ":061";
        notes.push("UDC :061 = Organisations / Institutions");
    }

    if (/\b(india|indian|punjab|delhi|haryana|bombay|bengal|madras)\b/i.test(text)) {
        placeUdc = "(540)";
        ddcPlace = ".0954";
        notes.push("UDC (540) = India");
    } else if (/\b(europe|european)\b/i.test(text) && /\b(america|american|usa)\b/i.test(text)) {
        placeUdc = "(4+73)";
        ddcPlace = ".094";
        notes.push("UDC (4+73) = Europe & America");
    } else if (/\b(america|american|usa|united\s*states)\b/i.test(text)) {
        placeUdc = "(73)";
        ddcPlace = ".0973";
        notes.push("UDC (73) = United States");
    } else if (/\b(britain|british|uk|england)\b/i.test(text)) {
        placeUdc = "(410)";
        ddcPlace = ".0941";
        notes.push("UDC (410) = Great Britain");
    } else if (/\b(international|world|global)\b/i.test(text)) {
        placeUdc = "(100)";
        ddcPlace = ".09";
        notes.push("UDC (100) = International");
    }

    return { placeUdc, ddcPlace, orgRel, notes };
}

// -------------------------------------------------------------
// 3. MASTER TAXONOMY WITH EXACT ROOT MATCHING
// -------------------------------------------------------------
const KNOWLEDGE_GRAPH = [
    // Scientists / Pure Sciences in General
    {
        keywords: ["scientist", "scientists", "scientific research", "science", "pure science", "natural science"],
        main: "Pure Sciences",
        sub: "General Pure Sciences & Scientists",
        udc: "5",
        ddc: "500",
        exp: "UDC 5 (Mathematics & Natural Sciences); DDC 500 (Natural sciences & mathematics)."
    },
    // Public Administration
    {
        keywords: ["public administration", "administration", "administrative", "civil service", "governance", "bureaucracy"],
        main: "Social Sciences",
        sub: "Public Administration & Management",
        udc: "35",
        ddc: "351",
        exp: "UDC 35 (Public administration); DDC 351 (Public administration)."
    },
    // Nursery rhymes / Folklore
    {
        keywords: ["nursery rhymes", "rhymes", "fairy tale", "folklore", "folk song", "folk tale", "mythology"],
        main: "Customs, Folklore & Literature",
        sub: "Folklore — Nursery Rhymes & Children's Folk Verse",
        udc: "398.8",
        ddc: "398.8",
        exp: "UDC 398.8 (Folk poetry, nursery rhymes); DDC 398.8 (Folklore rhymes)."
    },
    // Hindi Novels / Premchand
    {
        keywords: ["premchand", "prem chand", "godan", "gaban", "karambhumi", "karam bhumi", "rangbhumi", "nirmala", "hindi novel"],
        main: "Literature",
        sub: "Hindi Literature — Novel (Premchand)",
        udc: "891.43-31",
        ddc: "891.433",
        exp: "UDC 891.43-31 (Hindi novel with auxiliary -31); DDC 891.433 (Hindi fiction)."
    },
    {
        keywords: ["punjabi novel", "panjabi novel", "nanak singh"],
        main: "Literature",
        sub: "Punjabi Literature — Novel",
        udc: "891.42-31",
        ddc: "891.423",
        exp: "UDC 891.42-31 (Punjabi novel); DDC 891.423."
    },
    {
        keywords: ["novel", "novels", "fiction"],
        main: "Literature",
        sub: "Literature — Novels & Fiction",
        udc: "82-31",
        ddc: "808.83",
        exp: "UDC 82-31 (Novels); DDC 808.83 (Fiction)."
    },
    // Astronomy
    {
        keywords: ["astronomy", "astronomical", "astromical", "astrophysics", "solar system", "planet", "galaxy", "telescope"],
        main: "Pure Sciences",
        sub: "Astronomy & Astrophysics",
        udc: "52",
        ddc: "520",
        exp: "UDC 52 (Astronomy, Astrophysics); DDC 520."
    },
    // Library Science
    {
        keywords: ["bibliometrics", "scientometrics", "informetrics", "citation analysis"],
        main: "Library & Information Science",
        sub: "Bibliometrics & Citation Studies",
        udc: "02:001.811",
        ddc: "020.72",
        exp: "UDC 02:001.811 (Bibliometrics); DDC 020.72."
    },
    {
        keywords: ["cataloguing", "cataloging", "classified catalogue", "aacr", "ccc", "metadata"],
        main: "Library Science",
        sub: "Cataloguing & Metadata",
        udc: "025.3",
        ddc: "025.3",
        exp: "UDC 025.3 (Cataloguing); DDC 025.3."
    },
    {
        keywords: ["classification", "colon classification", "decimal classification", "udc", "ddc"],
        main: "Library Science",
        sub: "Classification Schemes",
        udc: "025.4",
        ddc: "025.4",
        exp: "UDC 025.4 (Classification); DDC 025.4."
    },
    {
        keywords: ["library", "libraries", "librarianship"],
        main: "Library Science",
        sub: "Library Science",
        udc: "02",
        ddc: "020",
        exp: "UDC 02 (Libraries); DDC 020."
    },
    // Computer Science
    {
        keywords: ["computer", "programming", "software", "algorithm", "artificial intelligence", "machine learning", "database"],
        main: "Computer Science",
        sub: "Computer Science & IT",
        udc: "004",
        ddc: "004",
        exp: "UDC 004 (Computer science); DDC 004."
    },
    // Pure Sciences (Specific)
    { keywords: ["mathematics", "math", "algebra", "calculus", "geometry", "statistics"], main: "Pure Sciences", sub: "Mathematics", udc: "51", ddc: "510", exp: "UDC 51 (Mathematics); DDC 510." },
    { keywords: ["physics", "quantum", "mechanics", "optics"], main: "Pure Sciences", sub: "Physics", udc: "53", ddc: "530", exp: "UDC 53 (Physics); DDC 530." },
    { keywords: ["chemistry", "chemical", "biochemistry"], main: "Pure Sciences", sub: "Chemistry", udc: "54", ddc: "540", exp: "UDC 54 (Chemistry); DDC 540." },
    { keywords: ["biology", "biological", "genetics", "evolution"], main: "Pure Sciences", sub: "Biological Sciences", udc: "57", ddc: "570", exp: "UDC 57 (Biology); DDC 570." },
    { keywords: ["botany", "plants", "flora"], main: "Pure Sciences", sub: "Botany", udc: "58", ddc: "580", exp: "UDC 58 (Botany); DDC 580." },
    { keywords: ["zoology", "animals", "wildlife"], main: "Pure Sciences", sub: "Zoology", udc: "59", ddc: "590", exp: "UDC 59 (Zoology); DDC 590." },
    { keywords: ["medicine", "medical", "surgery", "disease", "health"], main: "Applied Sciences", sub: "Medical Sciences", udc: "61", ddc: "610", exp: "UDC 61 (Medicine); DDC 610." },
    { keywords: ["engineering", "mechanical", "electrical", "civil"], main: "Applied Sciences", sub: "Engineering", udc: "62", ddc: "620", exp: "UDC 62 (Engineering); DDC 620." },
    { keywords: ["agriculture", "farming", "crops"], main: "Applied Sciences", sub: "Agriculture", udc: "63", ddc: "630", exp: "UDC 63 (Agriculture); DDC 630." },
    { keywords: ["management", "business", "commerce", "accounting"], main: "Applied Sciences", sub: "Management", udc: "65", ddc: "650", exp: "UDC 65 (Management); DDC 650." },
    { keywords: ["higher education", "university", "universities", "college"], main: "Social Sciences", sub: "Higher Education", udc: "378", ddc: "378", exp: "UDC 378 (Higher Education); DDC 378." },
    { keywords: ["education", "teaching", "pedagogy", "school"], main: "Social Sciences", sub: "Education", udc: "37", ddc: "370", exp: "UDC 37 (Education); DDC 370." },
    { keywords: ["law", "jurisprudence", "legal", "crimin"], main: "Social Sciences", sub: "Law & Jurisprudence", udc: "34", ddc: "340", exp: "UDC 34 (Law); DDC 340." },
    { keywords: ["economics", "economy", "banking", "finance"], main: "Social Sciences", sub: "Economics & Finance", udc: "33", ddc: "330", exp: "UDC 33 (Economics); DDC 330." },
    { keywords: ["politics", "political", "government", "democracy"], main: "Social Sciences", sub: "Political Science", udc: "32", ddc: "320", exp: "UDC 32 (Politics); DDC 320." },
    { keywords: ["sociology", "society", "social work"], main: "Social Sciences", sub: "Sociology", udc: "301", ddc: "301", exp: "UDC 301 (Sociology); DDC 301." },
    { keywords: ["history", "historical", "ancient", "medieval"], main: "Geography & History", sub: "History", udc: "93/99", ddc: "900", exp: "UDC 93/99 (History); DDC 900." }
];

// -------------------------------------------------------------
// 4. AUTOMATIC RESOLVER
// -------------------------------------------------------------
function autoClassify(rawTitle) {
    const raw = (rawTitle || '').trim();
    if (!raw) {
        return {
            main_subject: "Generalities",
            sub_subject: "General Knowledge",
            udc_breakdown: "001",
            confidence: "Standard Baseline",
            notation_audit: "Base notation 001 allocated.",
            explanation: "No title provided. Defaulted to Generalities.",
            sources: "UDC 1961 Edition; DDC 23rd Edition",
            ddc_answer: "001"
        };
    }

    const cleaned = cleanTokens(raw);

    // 1. Exact Reference Lookup
    let directUdc = udcIndex[raw] || udcIndex[cleaned];
    let directDdc = ddcIndex[raw] || ddcIndex[cleaned];

    if (!directUdc || !directDdc) {
        for (const k of Object.keys(udcIndex)) {
            if (cleanTokens(k) === cleaned) { directUdc = udcIndex[k]; break; }
        }
        for (const k of Object.keys(ddcIndex)) {
            if (cleanTokens(k) === cleaned) { directDdc = ddcIndex[k]; break; }
        }
    }

    if (directUdc || directDdc) {
        const u = directUdc || "001";
        const d = directDdc || "000";
        return {
            main_subject: "Direct Reference Index",
            sub_subject: raw,
            udc_breakdown: u,
            confidence: "100% Exact Reference Verification",
            notation_audit: `Direct notation match: ${u} preserved completely without truncation.`,
            explanation: "Verified directly against standard 1961 reference tables.",
            sources: "udc-1961-reference-index.json / ddc-23-reference-index.json",
            ddc_answer: d
        };
    }

    // 2. Auxiliaries
    const { formUdc, formDdc, isBiography, notes: formNotes } = getFormAuxiliary(cleaned);
    const { placeUdc, ddcPlace, orgRel, notes: placeNotes } = getPlaceAndOrg(cleaned);

    // 3. Subject Score Match
    let bestSubject = null;
    let maxScore = 0;

    for (const item of KNOWLEDGE_GRAPH) {
        let score = 0;
        for (const kw of item.keywords) {
            const re = new RegExp(`\\b${kw.replace(/\s+/g, '\\s+')}\\b`, 'i');
            if (re.test(cleaned)) {
                score += kw.length;
            }
        }
        if (score > maxScore) {
            maxScore = score;
            bestSubject = item;
        }
    }

    if (bestSubject) {
        let finalUdc = "";
        let finalDdc = "";
        let finalSub = bestSubject.sub;

        if (isBiography) {
            // Biography of specific subject: UDC 929:Subject(Place) or Subject(Place)(092)
            finalUdc = `929:${bestSubject.udc}${placeUdc}`;
            finalDdc = `${bestSubject.ddc === "500" ? "509.2" : bestSubject.ddc + ".092"}${ddcPlace}`;
            finalSub = `Biography of ${bestSubject.sub}`;
        } else {
            const isLit = bestSubject.udc.startsWith("8");
            finalUdc = `${bestSubject.udc}${isLit ? '' : placeUdc}${isLit ? '' : orgRel}${formUdc}`;
            finalDdc = `${bestSubject.ddc}${isLit ? '' : ddcPlace}${isLit ? '' : formDdc}`;
        }

        let expNotes = [bestSubject.exp];
        if (isBiography) expNotes.push("UDC 929: = Biography of Persons in Special Field");
        if (placeUdc) expNotes.push(`Place: ${placeUdc}`);
        if (formNotes.length && !isBiography) expNotes.push(`Form: ${formNotes.join(', ')}`);

        return {
            main_subject: bestSubject.main,
            sub_subject: finalSub,
            udc_breakdown: finalUdc,
            confidence: "High (Faceted Analytical Synthesis)",
            notation_audit: `Notation '${finalUdc}' fully synthesized without truncation.`,
            explanation: expNotes.join(' | '),
            sources: "Universal Decimal Classification (UDC 1961) & Dewey Decimal Classification (DDC 23rd)",
            ddc_answer: finalDdc
        };
    }

    // 4. Safe Semantic Inference
    let fallbackBaseUdc = "5/6";
    let fallbackBaseDdc = "500";
    let fallbackMain = "Pure & Applied Sciences";

    if (!/\b(sci|research|tech|nature)\b/i.test(cleaned)) {
        fallbackBaseUdc = "3";
        fallbackBaseDdc = "300";
        fallbackMain = "Social Sciences & Administration";
    }

    const fallbackUdc = `${fallbackBaseUdc}${placeUdc}${orgRel}${formUdc}`;
    const fallbackDdc = `${fallbackBaseDdc}${ddcPlace}${formDdc}`;

    return {
        main_subject: fallbackMain,
        sub_subject: raw,
        udc_breakdown: fallbackUdc,
        confidence: "Medium (Semantic Inference)",
        notation_audit: `Notation '${fallbackUdc}' synthesized from institutional tokens.`,
        explanation: `Analyzed through semantic classification. Place: ${placeUdc || 'none'}.`,
        sources: "UDC 1961 Edition Main Tables & DDC 23rd Edition",
        ddc_answer: fallbackDdc
    };
}

// -------------------------------------------------------------
// 5. API
