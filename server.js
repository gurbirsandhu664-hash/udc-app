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

function normalizeClean(str) {
    return (str || '')
        .toLowerCase()
        .replace(/[\(\)\[\]\{\}\<\>\,\.\:\;\-\_\/\\\"\'\?\!\@\#\$\%\^\&\*\+\=\~]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// -------------------------------------------------------------
// 1. FORMS, SERIALS & DOCUMENT TYPES (ANNUAL REPORT, ETC.)
// -------------------------------------------------------------
function extractDocumentForms(norm) {
    let formUdc = "";
    let formDdc = "";
    let formNotes = [];

    if (/\b(annual\s*report|progress\s*report|administrative\s*report|report|reports)\b/i.test(norm)) {
        formUdc = "(047)";
        formDdc = ".06";
        formNotes.push("UDC (047) = Reports, accounts of proceedings; DDC Table 1 .06 (Organizations & management)");
    } else if (/\b(director|directori|yearbook|year\s*book|almanac)\b/i.test(norm)) {
        formUdc = "(058)";
        formDdc = ".025";
        formNotes.push("UDC (058) = Directories / Yearbooks; DDC T1 .025");
    } else if (/\b(journal|periodical|magazine|bulletin|review)\b/i.test(norm)) {
        formUdc = "(05)";
        formDdc = ".05";
        formNotes.push("UDC (05) = Periodicals, serials; DDC T1 .05");
    } else if (/\b(handbook|manual|guidebook|compendium)\b/i.test(norm)) {
        formUdc = "(02)";
        formDdc = ".02";
        formNotes.push("UDC (02) = Handbooks / Manuals; DDC T1 .02");
    } else if (/\b(encycloped|encyclopaed)\b/i.test(norm)) {
        formUdc = "(03)";
        formDdc = ".03";
        formNotes.push("UDC (03) = Encyclopedias; DDC T1 .03");
    } else if (/\b(dictionar|glossar|lexicon)\b/i.test(norm)) {
        formUdc = "(038)";
        formDdc = ".03";
        formNotes.push("UDC (038) = Dictionaries");
    } else if (/\b(conference|proceedings|symposium|seminar)\b/i.test(norm)) {
        formUdc = "(063)";
        formDdc = ".06";
        formNotes.push("UDC (063) = Conferences / Symposia");
    }

    return { formUdc, formDdc, formNotes };
}

// -------------------------------------------------------------
// 2. GEOGRAPHICAL & CORPORATE BODIES / INSTITUTES
// -------------------------------------------------------------
function extractPlacesAndBodies(norm) {
    let placeUdc = "";
    let ddcPlace = "";
    let orgRel = "";
    let placeNotes = [];

    // Corporate / Institute relationship
    if (/\b(institute|institution|organisation|organization|association|society|academy|board|council|bureau|department)\b/i.test(norm)) {
        orgRel = ":061";
        placeNotes.push("UDC :061 = Institutions, organizations, corporate bodies");
    }

    // Place identification
    if (/\b(india|indian|punjab|delhi|haryana|bengal|bombay|madras)\b/i.test(norm)) {
        placeUdc = "(540)";
        ddcPlace = ".0954";
        placeNotes.push("UDC (540) = India; DDC .0954");
    } else if (/\b(europe|european)\b/i.test(norm) && /\b(america|american|usa)\b/i.test(norm)) {
        placeUdc = "(4+73)";
        ddcPlace = ".094";
        placeNotes.push("UDC (4+73) = Europe & America");
    } else if (/\b(america|american|usa|united\s*states)\b/i.test(norm)) {
        placeUdc = "(73)";
        ddcPlace = ".0973";
        placeNotes.push("UDC (73) = United States");
    } else if (/\b(britain|british|uk|england)\b/i.test(norm)) {
        placeUdc = "(410)";
        ddcPlace = ".0941";
        placeNotes.push("UDC (410) = Great Britain");
    } else if (/\b(international|world|global)\b/i.test(norm)) {
        placeUdc = "(100)";
        ddcPlace = ".09";
        placeNotes.push("UDC (100) = International, World-wide");
    }

    return { placeUdc, ddcPlace, orgRel, placeNotes };
}

// -------------------------------------------------------------
// 3. MASTER DISCIPLINARY TAXONOMY (UDC 0 TO 9 & DDC 000 TO 900)
// -------------------------------------------------------------
const COMPREHENSIVE_TAXONOMY = [
    // 35 Public Administration / Civil Service
    {
        re: /(public\s*administration|civil\s*service|administrative\s*law|public\s*affairs|bureaucracy|governance|public\s*sector\s*management|local\s*government|municipal\s*administration|police\s*administration)/i,
        main: "Social Sciences",
        sub: "Public Administration & Administrative Control",
        udc: "35",
        ddc: "351",
        exp: "UDC 35 (Public administration. Government. Military affairs); DDC 351 (Public administration)."
    },

    // Customs, Folklore & Nursery Rhymes
    {
        re: /(nursery\s*rhyme|rhymes|fairy\s*tale|folklore|folk\s*lore|folk\s*song|folk\s*tale|mythology)/i,
        main: "Customs, Folklore & Literature",
        sub: "Folklore — Nursery Rhymes & Children's Folk Verse",
        udc: "398.8",
        ddc: "398.8",
        exp: "UDC 398.8 (Folk poetry, rhymes, ballads, nursery rhymes); DDC 398.8 (Rhymes & games)."
    },

    // Specific Authors & Hindi Literature
    {
        re: /(prem\s*chand|munshi\s*prem|godan|gaban|karam\s*bhumi|karmabhumi|rangbhumi|nirmala|sevasadan|hindi\s+novel|hindi\s+fiction)/i,
        main: "Literature",
        sub: "Hindi Literature — Novel (Premchand)",
        udc: "891.43-31",
        ddc: "891.433",
        exp: "UDC 891.43-31 (Hindi novel); DDC 891.433 (Hindi fiction)."
    },
    {
        re: /(hindi\s+short\s+stor|hindi\s+kahani)/i,
        main: "Literature",
        sub: "Hindi Literature — Short Stories",
        udc: "891.43-32",
        ddc: "891.433",
        exp: "UDC 891.43-32 (Hindi short stories); DDC 891.433."
    },
    {
        re: /(hindi\s+poet|hindi\s+kavita|hindi\s+poem)/i,
        main: "Literature",
        sub: "Hindi Poetry",
        udc: "891.43-1",
        ddc: "891.431",
        exp: "UDC 891.43-1 (Hindi poetry); DDC 891.431."
    },
    {
        re: /(hindi\s+drama|hindi\s+natak)/i,
        main: "Literature",
        sub: "Hindi Drama",
        udc: "891.43-2",
        ddc: "891.432",
        exp: "UDC 891.43-2 (Hindi drama); DDC 891.432."
    },
    {
        re: /\b(hindi)\b/i,
        main: "Linguistics & Literature",
        sub: "Hindi Language & Literature",
        udc: "891.43",
        ddc: "891.43",
        exp: "UDC 891.43 (Hindi language & literature); DDC 891.43."
    },

    // Punjabi Literature
    {
        re: /(punjabi\s+novel|panjabi\s+novel)/i,
        main: "Literature",
        sub: "Punjabi Literature — Novel",
        udc: "891.42-31",
        ddc: "891.423",
        exp: "UDC 891.42-31 (Punjabi novel); DDC 891.423."
    },
    {
        re: /(punjabi\s+poet|punjabi\s+kavita|waris\s*shah|bulleh\s*shah)/i,
        main: "Literature",
        sub: "Punjabi Poetry",
        udc: "891.42-1",
        ddc: "891.421",
        exp: "UDC 891.42-1 (Punjabi poetry); DDC 891.421."
    },
    {
        re: /\b(punjabi|panjabi)\b/i,
        main: "Linguistics & Literature",
        sub: "Punjabi Language & Literature",
        udc: "891.42",
        ddc: "891.42",
        exp: "UDC 891.42 (Punjabi language & literature); DDC 891.42."
    },

    // General Literature
    {
        re: /\b(novel|novels|fiction)\b/i,
        main: "Literature",
        sub: "Literature — Novels & Fiction",
        udc: "82-31",
        ddc: "808.83",
        exp: "UDC 82-31 (Novels); DDC 808.83."
    },
    {
        re: /\b(poetry|poem|poems|verse)\b/i,
        main: "Literature",
        sub: "Literature — Poetry",
        udc: "82-1",
        ddc: "808.81",
        exp: "UDC 82-1 (Poetry); DDC 808.81."
    },
    {
        re: /\b(drama|play|plays)\b/i,
        main: "Literature",
        sub: "Literature — Drama",
        udc: "82-2",
        ddc: "808.82",
        exp: "UDC 82-2 (Drama); DDC 808.82."
    },

    // Astronomy
    {
        re: /(astronom|astromic|astrophysic|planet|solar|observator|galaxy|celestial|telescope)/i,
        main: "Pure Sciences",
        sub: "Astronomy & Astrophysics",
        udc: "52",
        ddc: "520",
        exp: "UDC 52 (Astronomy, Astrophysics); DDC 520."
    },

    // Library Science
    {
        re: /(bibliometr|scientometr|informetr|citation\s*analysis)/i,
        main: "Library & Information Science",
        sub: "Bibliometrics",
        udc: "02:001.811",
        ddc: "020.72",
        exp: "UDC 02:001.811 (Bibliometrics); DDC 020.72."
    },
    {
        re: /(catalogu|catalog|classified\s*catalogue|aacr|ccc)/i,
        main: "Library Science",
        sub: "Cataloguing",
        udc: "025.3",
        ddc: "025.3",
        exp: "UDC 025.3 (Cataloguing); DDC 025.3."
    },
    {
        re: /(classif|colon\s*classification|decimal\s*classification|udc|ddc)/i,
        main: "Library Science",
        sub: "Classification",
        udc: "025.4",
        ddc: "025.4",
        exp: "UDC 025.4 (Classification); DDC 025.4."
    },
    {
        re: /(librar|librarianship|information\s*centre|library\s*science)/i,
        main: "Library Science",
        sub: "Library Science",
        udc: "02",
        ddc: "020",
        exp: "UDC 02 (Libraries); DDC 020."
    },

    // Computer Science
    {
        re: /(computer|programming|software|algorithm|artificial\s*intelligence|machine\s*learning|database|cloud)/i,
        main: "Computer Science",
        sub: "Computer Science & IT",
        udc: "004",
        ddc: "004",
        exp: "UDC 004 (Computer science); DDC 004."
    },

    // Philosophy & Psychology
    { re: /(logic|symbolic\s*logic)/i, main: "Philosophy", sub: "Logic", udc: "16", ddc: "160", exp: "UDC 16 (Logic); DDC 160." },
    { re: /(ethics|moral)/i, main: "Philosophy", sub: "Ethics", udc: "17", ddc: "170", exp: "UDC 17 (Ethics); DDC 170." },
    { re: /(psycholog|mental\s*health|cogniti)/i, main: "Philosophy & Psychology", sub: "Psychology", udc: "159.9", ddc: "150", exp: "UDC 159.9 (Psychology); DDC 150." },
    { re: /(philosoph|metaphysic)/i, main: "Philosophy", sub: "Philosophy", udc: "1", ddc: "100", exp: "UDC 1 (Philosophy); DDC 100." },

    // Religion
    { re: /(sikh|gurmat|gurbani)/i, main: "Religion", sub: "Sikhism", udc: "294.553", ddc: "294.6", exp: "UDC 294.553 (Sikhism); DDC 294.6." },
    { re: /(hindu|vedas|gita)/i, main: "Religion", sub: "Hinduism", udc: "294.51", ddc: "294.5", exp: "UDC 294.51 (Hinduism); DDC 294.5." },
    { re: /(islam|quran|muslim)/i, main: "Religion", sub: "Islam", udc: "297", ddc: "297", exp: "UDC 297 (Islam); DDC 297." },
    { re: /(christian|bible|church)/i, main: "Religion", sub: "Christianity", udc: "22/28", ddc: "230", exp: "UDC 22/28 (Christianity); DDC 230." },
    { re: /(religion|theolog)/i, main: "Religion", sub: "Religion", udc: "2", ddc: "200", exp: "UDC 2 (Religion); DDC 200." },

    // Social Sciences (Law, Economics, Politics, Education)
    { re: /(higher\s*education|universit|college)/i, main: "Social Sciences", sub: "Higher Education", udc: "378", ddc: "378", exp: "UDC 378 (Higher education); DDC 378." },
    { re: /(education|teaching|pedagog)/i, main: "Social Sciences", sub: "Education", udc: "37", ddc: "370", exp: "UDC 37 (Education); DDC 370." },
    { re: /(law|jurisprudence|legal|crimin)/i, main: "Social Sciences", sub: "Law", udc: "34", ddc: "340", exp: "UDC 34 (Law); DDC 340." },
    { re: /(economic|banking|finance)/i, main: "Social Sciences", sub: "Economics", udc: "33", ddc: "330", exp: "UDC 33 (Economics); DDC 330." },
    { re: /(politic|government|state)/i, main: "Social Sciences", sub: "Political Science", udc: "32", ddc: "320", exp: "UDC 32 (Politics); DDC 320." },
    { re: /(sociolog|society)/i, main: "Social Sciences", sub: "Sociology", udc: "301", ddc: "301", exp: "UDC 301 (Sociology); DDC 301." },

    // Pure Sciences (Math, Physics, Chem, Bio, Botany, Zoology)
    { re: /(mathemat|algebra|calculus|geometr|statistic)/i, main: "Pure Sciences", sub: "Mathematics", udc: "51", ddc: "510", exp: "UDC 51 (Mathematics); DDC 510." },
    { re: /(physic|quantum|mechanic)/i, main: "Pure Sciences", sub: "Physics", udc: "53", ddc: "530", exp: "UDC 53 (Physics); DDC 530." },
    { re: /(chemistr|biochemist)/i, main: "Pure Sciences", sub: "Chemistry", udc: "54", ddc: "540", exp: "UDC 54 (Chemistry); DDC 540." },
    { re: /(biolog|genet|evolution)/i, main: "Pure Sciences", sub: "Biology", udc: "57", ddc: "570", exp: "UDC 57 (Biology); DDC 570." },
    { re: /(botan|plant)/i, main: "Pure Sciences", sub: "Botany", udc: "58", ddc: "580", exp: "UDC 58 (Botany); DDC 580." },
    { re: /(zoolog|animal)/i, main: "Pure Sciences", sub: "Zoology", udc: "59", ddc: "590", exp: "UDC 59 (Zoology); DDC 590." },

    // Applied Sciences (Medicine, Engineering, Agriculture, Management)
    { re: /(medicin|medical|disease|health)/i, main: "Applied Sciences", sub: "Medical Sciences", udc: "61", ddc: "610", exp: "UDC 61 (Medicine); DDC 610." },
    { re: /(engineer|mechanical|electrical|civil)/i, main: "Applied Sciences", sub: "Engineering", udc: "62", ddc: "620", exp: "UDC 62 (Engineering); DDC 620." },
    { re: /(agricult|farm|crop)/i, main: "Applied Sciences", sub: "Agriculture", udc: "63", ddc: "630", exp: "UDC 63 (Agriculture); DDC 630." },
    { re: /(management|business)/i, main: "Applied Sciences", sub: "Management", udc: "65", ddc: "650", exp: "UDC 65 (Management); DDC 650." },

    // Arts, Geography, History
    { re: /(art|painting|music)/i, main: "The Arts", sub: "Fine Arts", udc: "7", ddc: "700", exp: "UDC 7 (The Arts); DDC 700." },
    { re: /(geograph|travel|map)/i, main: "Geography & History", sub: "Geography", udc: "91", ddc: "910", exp: "UDC 91 (Geography); DDC 910." },
    { re: /(histor|ancient|medieval)/i, main: "Geography & History", sub: "History", udc: "93/99", ddc: "900", exp: "UDC 93/99 (History); DDC 900." }
];

// -------------------------------------------------------------
// 4. SYNTHESIS ENGINE
// -------------------------------------------------------------
function classifyMasterEngine(rawTitle) {
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

    const norm = normalizeClean(raw);

    // 1. DIRECT JSON REFERENCE CHECK
    let directUdc = udcIndex[raw] || udcIndex[norm];
    let directDdc = ddcIndex[raw] || ddcIndex[norm];

    if (!directUdc || !directDdc) {
        for (const k of Object.keys(udcIndex)) {
            if (normalizeClean(k) === norm) { directUdc = udcIndex[k]; break; }
        }
        for (const k of Object.keys(ddcIndex)) {
            if (normalizeClean(k) === norm) { directDdc = ddcIndex[k]; break; }
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

    // 2. PARSE FORMS, SERIALS & PLACES
    const { formUdc, formDdc, formNotes } = extractDocumentForms(norm);
    const { placeUdc, ddcPlace, orgRel, placeNotes } = extractPlacesAndBodies(norm);

    // 3. IDENTIFY SUBJECT DISCIPLINE
    let found = null;
    for (const d of COMPREHENSIVE_TAXONOMY) {
        if (d.re.test(norm)) {
            found = d;
            break;
        }
    }

    if (found) {
        const isLiterature = found.udc.startsWith("8");
        // Literature does not attach directory/org auxiliaries
        const finalPlace = isLiterature ? "" : placeUdc;
        const finalForm = isLiterature ? "" : formUdc;
        const finalOrg = isLiterature ? "" : orgRel;

        // UDC faceted synthesis: Subject + Place + Org + Form
        const finalUdc = `${found.udc}${finalPlace}${finalOrg}${finalForm}`;
        
        // DDC faceted synthesis: Subject + Standard Subdivisions
        const finalDdc = `${found.ddc}${isLiterature ? '' : ddcPlace}${isLiterature ? '' : formDdc}`;

        let finalNotes = [found.exp];
        if (placeNotes.length && !isLiterature) finalNotes.push(placeNotes.join('; '));
        if (formNotes.length && !isLiterature) finalNotes.push(formNotes.join('; '));

        return {
            main_subject: found.main,
            sub_subject: found.sub,
            udc_breakdown: finalUdc,
            confidence: "High (Faceted Analytical Synthesis)",
            notation_audit: `Notation '${finalUdc}' fully synthesized: Auxiliary symbols, places, and corporate bodies preserved without truncation.`,
            explanation: finalNotes.join(' | '),
            sources: "Universal Decimal Classification (UDC 1961) & Dewey Decimal Classification (DDC 23rd)",
            ddc_answer: finalDdc
        };
    }

    // 4. FALLBACK: GENERALITIES WITH STRUCTURAL EXTENSIONS
    const fallbackUdc = `001${placeUdc}${orgRel}${formUdc}`;
    return {
        main_subject: "Generalities & Interdisciplinary",
        sub_subject: raw,
        udc_breakdown: fallbackUdc,
        confidence: "Medium (Structural Synthesis)",
        notation_audit: `Notation '${fallbackUdc}' allocated with extensions.`,
        explanation: "Title analyzed under general knowledge foundations.",
        sources: "UDC 1961 Class 0",
        ddc_answer: `001${ddcPlace}${formDdc}`
    };
}

// -------------------------------------------------------------
// 5. UNIVERSAL API ENDPOINT
// -------------------------------------------------------------
app.all(['/api/classify', '/api/search', '/classify'], (req, res) => {
    try {
        const title = req.body?.title || req.query?.title || req.query?.q || '';
        const r = classifyMasterEngine(title);

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
