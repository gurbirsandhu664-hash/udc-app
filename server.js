const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// 1. ਸੁਰੱਖਿਅਤ ਇੰਡੈਕਸ ਲੋਡਰ
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

// ਟੈਕਸਟ ਕਲੀਨਰ
function cleanTokens(str) {
    return (str || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// -------------------------------------------------------------
// 2. ਆਟੋਮੈਟਿਕ ਫੈਸਿਟ (FACET) ਐਕਸਟਰੈਕਟਰ
// -------------------------------------------------------------
const PLACE_MAP = [
    { re: /\b(india|indian|punjab|delhi|haryana|bombay|bengal|madras)\b/i, udc: "(540)", ddc: ".0954", name: "India" },
    { re: /\b(europe|european)\b/i, udc: "(4)", ddc: ".094", name: "Europe" },
    { re: /\b(america|american|usa|united\s*states)\b/i, udc: "(73)", ddc: ".0973", name: "United States" },
    { re: /\b(britain|british|uk|england)\b/i, udc: "(410)", ddc: ".0941", name: "Great Britain" },
    { re: /\b(international|world|global)\b/i, udc: "(100)", ddc: ".09", name: "International / World" }
];

const FORM_MAP = [
    { re: /\b(annual\s*reports?|progress\s*reports?|administrative\s*reports?|reports?)\b/i, udc: "(047)", ddc: ".06", name: "Reports / Proceedings" },
    { re: /\b(directories|directory|yearbooks?|almanacs?)\b/i, udc: "(058)", ddc: ".025", name: "Directories / Yearbooks" },
    { re: /\b(journals?|periodicals?|magazines?|bulletins?)\b/i, udc: "(05)", ddc: ".05", name: "Periodicals / Serials" },
    { re: /\b(handbooks?|manuals?|guidebooks?|guides?)\b/i, udc: "(02)", ddc: ".02", name: "Handbooks / Manuals" },
    { re: /\b(encyclopedias?|encyclopaedias?)\b/i, udc: "(03)", ddc: ".03", name: "Encyclopedias" },
    { re: /\b(dictionaries|dictionary|glossaries?)\b/i, udc: "(038)", ddc: ".03", name: "Dictionaries" },
    { re: /\b(conferences?|proceedings?|seminars?|symposia)\b/i, udc: "(063)", ddc: ".06", name: "Conferences" },
    { re: /\b(bibliographies|bibliography)\b/i, udc: "(01)", ddc: "016", isBiblio: true, name: "Bibliographies" }
];

// -------------------------------------------------------------
// 3. ਆਟੋਮੈਟਿਕ ਵਿਸ਼ਾ ਗਿਆਨ-ਕੋਸ਼ (UDC 1961 & DDC 23)
// -------------------------------------------------------------
const KNOWLEDGE_GRAPH = [
    // ਪ੍ਰਸ਼ਾਸਨ (Public Administration)
    {
        keywords: ["public administration", "administration", "administrative", "civil service", "governance", "bureaucracy", "municipal"],
        main: "Social Sciences",
        sub: "Public Administration & Management",
        udc: "35",
        ddc: "351",
        exp: "UDC 35 (Public administration); DDC 351 (Public administration)."
    },
    // ਲੋਕਧਾਰਾ / ਬਾਲ ਗੀਤ (Folklore / Nursery Rhymes)
    {
        keywords: ["nursery rhymes", "rhymes", "fairy tale", "folklore", "folk song", "folk tale", "mythology", "lullaby"],
        main: "Customs, Folklore & Literature",
        sub: "Folklore — Nursery Rhymes & Children's Folk Verse",
        udc: "398.8",
        ddc: "398.8",
        exp: "UDC 398.8 (Folk poetry, nursery rhymes); DDC 398.8 (Folklore rhymes)."
    },
    // ਹਿੰਦੀ ਨਾਵਲ / ਪ੍ਰੇਮਚੰਦ (Premchand & Hindi Novels)
    {
        keywords: ["premchand", "prem chand", "godan", "gaban", "karambhumi", "karam bhumi", "rangbhumi", "nirmala", "sevasadan", "hindi novel"],
        main: "Literature",
        sub: "Hindi Literature — Novel (Premchand)",
        udc: "891.43-31",
        ddc: "891.433",
        exp: "UDC 891.43-31 (Hindi novel with auxiliary -31); DDC 891.433 (Hindi fiction)."
    },
    {
        keywords: ["hindi story", "hindi kahani"],
        main: "Literature",
        sub: "Hindi Literature — Short Story",
        udc: "891.43-32",
        ddc: "891.433",
        exp: "UDC 891.43-32 (Hindi short story); DDC 891.433."
    },
    {
        keywords: ["hindi poetry", "hindi kavita", "kabir", "tulsidas"],
        main: "Literature",
        sub: "Hindi Literature — Poetry",
        udc: "891.43-1",
        ddc: "891.431",
        exp: "UDC 891.43-1 (Hindi poetry); DDC 891.431."
    },
    {
        keywords: ["hindi drama", "hindi natak"],
        main: "Literature",
        sub: "Hindi Literature — Drama",
        udc: "891.43-2",
        ddc: "891.432",
        exp: "UDC 891.43-2 (Hindi drama); DDC 891.432."
    },
    {
        keywords: ["hindi", "devanagari"],
        main: "Linguistics & Literature",
        sub: "Hindi Language & Literature",
        udc: "891.43",
        ddc: "891.43",
        exp: "UDC 891.43 (Hindi language and literature); DDC 891.43."
    },
    // ਪੰਜਾਬੀ ਸਾਹਿਤ
    {
        keywords: ["punjabi novel", "panjabi novel", "nanak singh"],
        main: "Literature",
        sub: "Punjabi Literature — Novel",
        udc: "891.42-31",
        ddc: "891.423",
        exp: "UDC 891.42-31 (Punjabi novel with auxiliary -31); DDC 891.423."
    },
    {
        keywords: ["punjabi poetry", "punjabi kavita", "waris shah", "amrita pritam"],
        main: "Literature",
        sub: "Punjabi Literature — Poetry",
        udc: "891.42-1",
        ddc: "891.421",
        exp: "UDC 891.42-1 (Punjabi poetry); DDC 891.421."
    },
    {
        keywords: ["punjabi", "panjabi", "gurmukhi"],
        main: "Linguistics & Literature",
        sub: "Punjabi Language & Literature",
        udc: "891.42",
        ddc: "891.42",
        exp: "UDC 891.42 (Punjabi language and literature); DDC 891.42."
    },
    // ਆਮ ਸਾਹਿਤ (General Literature Forms)
    {
        keywords: ["novel", "novels", "fiction"],
        main: "Literature",
        sub: "Literature — Novels & Fiction",
        udc: "82-31",
        ddc: "808.83",
        exp: "UDC 82-31 (Novels); DDC 808.83 (Fiction)."
    },
    {
        keywords: ["poetry", "poems", "verse"],
        main: "Literature",
        sub: "Literature — Poetry",
        udc: "82-1",
        ddc: "808.81",
        exp: "UDC 82-1 (Poetry); DDC 808.81."
    },
    {
        keywords: ["drama", "plays", "theatre"],
        main: "Literature",
        sub: "Literature — Drama",
        udc: "82-2",
        ddc: "808.82",
        exp: "UDC 82-2 (Drama); DDC 808.82."
    },
    // ਖਗੋਲ ਵਿਗਿਆਨ (Astronomy)
    {
        keywords: ["astronomy", "astronomical", "astromical", "astrophysics", "solar system", "planet", "galaxy", "telescope", "observatory"],
        main: "Pure Sciences",
        sub: "Astronomy & Space Research",
        udc: "52",
        ddc: "520",
        exp: "UDC 52 (Astronomy, Space sciences); DDC 520 (Astronomy)."
    },
    // ਲਾਇਬ੍ਰੇਰੀ ਸਾਇੰਸ (Library Science)
    {
        keywords: ["bibliometrics", "scientometrics", "informetrics", "citation analysis"],
        main: "Library & Information Science",
        sub: "Bibliometrics & Citation Analysis",
        udc: "02:001.811",
        ddc: "020.72",
        exp: "UDC 02:001.811 (Bibliometrics in Libraries); DDC 020.72."
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
        exp: "UDC 025.4 (Classification schemes); DDC 025.4."
    },
    {
        keywords: ["library", "libraries", "librarianship", "documentation centre"],
        main: "Library Science",
        sub: "Library Science & Administration",
        udc: "02",
        ddc: "020",
        exp: "UDC 02 (Libraries & Librarianship); DDC 020."
    },
    // ਕੰਪਿਊਟਰ ਵਿਗਿਆਨ (Computer Science)
    {
        keywords: ["computer", "programming", "software", "algorithm", "artificial intelligence", "machine learning", "database", "cloud"],
        main: "Computer Science",
        sub: "Computer Science & IT",
        udc: "004",
        ddc: "004",
        exp: "UDC 004 (Computer science & IT); DDC 004."
    },
    // ਧਰਮ (Religion)
    { keywords: ["sikhism", "sikh", "gurmat", "gurbani", "guru granth"], main: "Religion", sub: "Sikhism", udc: "294.553", ddc: "294.6", exp: "UDC 294.553 (Sikhism); DDC 294.6." },
    { keywords: ["hinduism", "hindu", "vedas", "gita"], main: "Religion", sub: "Hinduism", udc: "294.51", ddc: "294.5", exp: "UDC 294.51 (Hinduism); DDC 294.5." },
    { keywords: ["islam", "muslim", "quran", "prophet"], main: "Religion", sub: "Islam", udc: "297", ddc: "297", exp: "UDC 297 (Islam); DDC 297." },
    { keywords: ["christianity", "christian", "bible", "jesus"], main: "Religion", sub: "Christianity", udc: "22/28", ddc: "230", exp: "UDC 22/28 (Christianity); DDC 230." },
    // ਸਮਾਜਿਕ ਵਿਗਿਆਨ (Social Sciences)
    { keywords: ["higher education", "university", "universities", "college"], main: "Social Sciences", sub: "Higher Education", udc: "378", ddc: "378", exp: "UDC 378 (Higher Education); DDC 378." },
    { keywords: ["education", "teaching", "pedagogy", "school"], main: "Social Sciences", sub: "Education", udc: "37", ddc: "370", exp: "UDC 37 (Education); DDC 370." },
    { keywords: ["law", "jurisprudence", "legal", "court", "crimin"], main: "Social Sciences", sub: "Law & Jurisprudence", udc: "34", ddc: "340", exp: "UDC 34 (Law); DDC 340." },
    { keywords: ["economics", "economy", "banking", "finance", "monetary", "trade"], main: "Social Sciences", sub: "Economics & Finance", udc: "33", ddc: "330", exp: "UDC 33 (Economics); DDC 330." },
    { keywords: ["politics", "political", "government", "democracy", "state"], main: "Social Sciences", sub: "Political Science", udc: "32", ddc: "320", exp: "UDC 32 (Politics); DDC 320." },
    { keywords: ["sociology", "society", "social work", "caste"], main: "Social Sciences", sub: "Sociology", udc: "301", ddc: "301", exp: "UDC 301 (Sociology); DDC 301." },
    // ਵਿਗਿਆਨ (Pure & Applied Sciences)
    { keywords: ["mathematics", "math", "algebra", "calculus", "geometry", "statistics"], main: "Pure Sciences", sub: "Mathematics", udc: "51", ddc: "510", exp: "UDC 51 (Mathematics); DDC 510." },
    { keywords: ["physics", "quantum", "mechanics", "optics"], main: "Pure Sciences", sub: "Physics", udc: "53", ddc: "530", exp: "UDC 53 (Physics); DDC 530." },
    { keywords: ["chemistry", "chemical", "biochemistry", "organic"], main: "Pure Sciences", sub: "Chemistry", udc: "54", ddc: "540", exp: "UDC 54 (Chemistry); DDC 540." },
    { keywords: ["biology", "biological", "genetics", "evolution"], main: "Pure Sciences", sub: "Biological Sciences", udc: "57", ddc: "570", exp: "UDC 57 (Biology); DDC 570." },
    { keywords: ["botany", "plants", "flora"], main: "Pure Sciences", sub: "Botany", udc: "58", ddc: "580", exp: "UDC 58 (Botany); DDC 580." },
    { keywords: ["zoology", "animals", "wildlife"], main: "Pure Sciences", sub: "Zoology", udc: "59", ddc: "590", exp: "UDC 59 (Zoology); DDC 590." },
    { keywords: ["medicine", "medical", "surgery", "disease", "health", "hospital"], main: "Applied Sciences", sub: "Medical Sciences", udc: "61", ddc: "610", exp: "UDC 61 (Medicine); DDC 610." },
    { keywords: ["engineering", "mechanical", "electrical", "civil"], main: "Applied Sciences", sub: "Engineering", udc: "62", ddc: "620", exp: "UDC 62 (Engineering); DDC 620." },
    { keywords: ["agriculture", "farming", "crops", "horticulture"], main: "Applied Sciences", sub: "Agriculture", udc: "63", ddc: "630", exp: "UDC 63 (Agriculture); DDC 630." },
    { keywords: ["management", "business", "commerce", "marketing", "accounting"], main: "Applied Sciences", sub: "Management", udc: "65", ddc: "650", exp: "UDC 65 (Management); DDC 650." },
    { keywords: ["arts", "art", "painting", "sculpture", "music"], main: "The Arts", sub: "Fine Arts", udc: "7", ddc: "700", exp: "UDC 7 (The Arts); DDC 700." },
    { keywords: ["geography", "geographical", "travel", "maps"], main: "Geography & History", sub: "Geography", udc: "91", ddc: "910", exp: "UDC 91 (Geography); DDC 910." },
    { keywords: ["history", "historical", "ancient", "medieval", "modern history"], main: "Geography & History", sub: "History", udc: "93/99", ddc: "900", exp: "UDC 93/99 (History); DDC 900." }
];

// -------------------------------------------------------------
// 4. ਆਟੋਮੈਟਿਕ ਸਿੰਥੇਸਿਸ ਇੰਜਣ (AUTOMATIC SYNTHESIS ENGINE)
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

    // ਕਦਮ 1: ਡਾਇਰੈਕਟ ਰੈਫਰੈਂਸ ਫਾਈਲ ਚੈੱਕ
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

    // ਕਦਮ 2: ਆਟੋਮੈਟਿਕ ਫੈਸਿਟ ਐਕਸਟਰੈਕਸ਼ਨ (Place, Form, Corporate Body)
    let matchedPlaces = [];
    let ddcPlaceExt = "";
    for (const p of PLACE_MAP) {
        if (p.re.test(cleaned)) {
            matchedPlaces.push(p);
            if (!ddcPlaceExt) ddcPlaceExt = p.ddc;
        }
    }

    let placeUdc = "";
    if (matchedPlaces.length >= 2) {
        placeUdc = `(${matchedPlaces.map(x => x.udc.replace(/[\(\)]/g, '')).join('+')})`;
    } else if (matchedPlaces.length === 1) {
        placeUdc = matchedPlaces[0].udc;
    }

    let formUdc = "";
    let ddcFormExt = "";
    let isBiblio = false;
    let formExp = [];
    for (const f of FORM_MAP) {
        if (f.re.test(cleaned)) {
            formUdc = f.udc;
            ddcFormExt = f.ddc;
            if (f.isBiblio) isBiblio = true;
            formExp.push(f.name);
            break;
        }
    }

    let orgRel = "";
    if (/\b(institutes?|institutions?|organisations?|organizations?|associations?|societies|society|academies|academy|boards?|councils?)\b/i.test(cleaned)) {
        orgRel = ":061";
    }

    // ਕਦਮ 3: ਆਟੋਮੈਟਿਕ ਸਕੋਰਿੰਗ ਨਾਲ ਵਿਸ਼ਾ ਮੈਚਿੰਗ
    let bestSubject = null;
    let maxScore = 0;

    for (const item of KNOWLEDGE_GRAPH) {
        let score = 0;
        for (const kw of item.keywords) {
            const re = new RegExp(`\\b${kw.replace(/\s+/g, '\\s+')}\\b`, 'i');
            if (re.test(cleaned)) {
                score += kw.length; // ਲੰਬੇ ਅਤੇ ਸਟੀਕ ਸ਼ਬਦ ਨੂੰ ਵੱਧ ਤਰਜੀਹ
            }
        }
        if (score > maxScore) {
            maxScore = score;
            bestSubject = item;
        }
    }

    // ਕਦਮ 4: ਸਿੰਥੇਸਾਈਜ਼ਡ ਨਤੀਜਾ ਤਿਆਰ ਕਰਨਾ
    if (bestSubject) {
        const isLiterature = bestSubject.udc.startsWith("8");
        const finalPlace = isLiterature ? "" : placeUdc;
        const finalForm = isLiterature ? "" : formUdc;
        const finalOrg = isLiterature ? "" : orgRel;

        let finalUdc = "";
        let finalDdc = "";

        if (isBiblio) {
            // ਵਿਸ਼ਾ-ਬਿਬਲੀਓਗ੍ਰਾਫੀ: UDC 016:Subject(Place)
            finalUdc = `016:${bestSubject.udc}${finalPlace}`;
            finalDdc = `016.${bestSubject.ddc.replace('.', '')}`;
        } else {
            finalUdc = `${bestSubject.udc}${finalPlace}${finalOrg}${finalForm}`;
            finalDdc = `${bestSubject.ddc}${isLiterature ? '' : ddcPlaceExt}${isLiterature ? '' : ddcFormExt}`;
        }

        let expNotes = [bestSubject.exp];
        if (placeUdc && !isLiterature) expNotes.push(`Place Auxiliary: ${placeUdc}`);
        if (orgRel && !isLiterature) expNotes.push(`Corporate Body: :061`);
        if (formExp.length && !isLiterature) expNotes.push(`Form Auxiliary: ${formExp.join(', ')}`);

        return {
            main_subject: bestSubject.main,
            sub_subject: isBiblio ? `Bibliography of ${bestSubject.sub}` : bestSubject.sub,
            udc_breakdown: finalUdc,
            confidence: "High (Automatic Faceted Synthesis)",
            notation_audit: `Notation '${finalUdc}' fully synthesized: Symbols, colons, places, and auxiliaries preserved.`,
            explanation: expNotes.join(' | '),
            sources: "Universal Decimal Classification (UDC 1961) & Dewey Decimal Classification (DDC 23rd)",
            ddc_answer: finalDdc
        };
    }

    // ਕਦਮ 5: ਸਮਾਰਟ ਇਨਫਰੈਂਸ (001 ਡੰਪ ਖ਼ਤਮ)
    let fallbackBaseUdc = "3";
    let fallbackBaseDdc = "300";
    let fallbackMain = "Social Sciences & Administration";

    if (/\b(science|technology|medical|physics|chemistry|biology|nature|engineering)\b/i.test(cleaned)) {
        fallbackBaseUdc = "5/6";
        fallbackBaseDdc = "500";
        fallbackMain = "Pure & Applied Sciences";
    }

    const fallbackUdc = `${fallbackBaseUdc}${placeUdc}${orgRel}${formUdc}`;
    const fallbackDdc = `${fallbackBaseDdc}${ddcPlaceExt}${ddcFormExt}`;

    return {
        main_subject: fallbackMain,
        sub_subject: raw,
        udc_breakdown: fallbackUdc,
        confidence: "Medium (Semantic Root Inference)",
        notation_audit: `Notation '${fallbackUdc}' synthesized from institutional tokens.`,
        explanation: `Analyzed through semantic classification. Place: ${placeUdc || 'none'}, Form: ${formUdc || 'none'}.`,
        sources: "UDC 1961 Edition Main Tables & DDC 23rd Edition",
        ddc_answer: fallbackDdc
    };
}

// -------------------------------------------------------------
// 5. ਯੂਨੀਵਰਸਲ API ਐਂਡਪੁਆਇੰਟ (8 UI ਕਾਰਡ ਮੈਪਿੰਗ)
// -------------------------------------------------------------
app.all(['/api/classify', '/api/search', '/classify'], (req, res) => {
    try {
        const title = req.body?.title || req.query?.title || req.query?.q || '';
        const r = autoClassify(title);

        res.json({
            success: true,
            title: title,
            main_subject: r.main_subject,
            sub_subject: r.sub_subject,
            udc_breakdown: r.udc_breakdown,
            confidence: r.confidence,
            notation_audit: r.notation_audit,
            explanation: r.explanation,
            sources: r.sources,
            ddc_answer: r.ddc_answer,
            mainSubject: r.main_subject,
            subSubject: r.sub_subject,
            udcBreakdown: r.udc_breakdown,
            notationAudit: r.notation_audit,
            ddcAnswer: r.ddc_answer,
            udc: r.udc_breakdown,
            ddc: r.ddc_answer,
            result: r,
            data: r
        });
    } catch (err) {
        console.error("API Error:", err);
        res.status(500).json({ error: "Classification engine error" });
    }
});

app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send("UDC & DDC Classifier is live.");
    }
});

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err.message));
process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err));

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
