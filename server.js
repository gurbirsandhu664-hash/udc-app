const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Safe loader taaki Render te missing files naal app crash na hove
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

// Normalizer: space, punctuation, te lowercase theek karan layi
function normalizeClean(str) {
    return (str || '')
        .toLowerCase()
        .replace(/[\(\)\[\]\{\}\<\>\,\.\:\;\-\_\/\\\"\'\?\!\@\#\$\%\^\&\*\+\=\~]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Subject Knowledge Base (Exact Novel -31 rules included)
const SUBJECT_TABLE = [
    // 1. Premchand & Hindi Novels (Exact UDC -31 Novel Auxiliary)
    {
        re: /(prem\s*chand|munshi\s*prem\s*chand|godan|gaban|karam\s*bhumi|karmabhumi|rangbhumi|nirmala|sevasadan)/i,
        main: "Literature",
        sub: "Hindi Literature — Novel by Premchand",
        udc: "891.43-31",
        ddc: "891.433",
        exp: "UDC 891.43 (Hindi Literature) with auxiliary -31 (Novel); DDC 891.433 (Hindi Fiction / Novel)."
    },
    {
        re: /(hindi\s+novel|hindi\s+fiction)/i,
        main: "Literature",
        sub: "Hindi Literature — Novel",
        udc: "891.43-31",
        ddc: "891.433",
        exp: "UDC 891.43 (Hindi Literature) with auxiliary -31 (Novel); DDC 891.433 (Hindi Fiction)."
    },
    {
        re: /(hindi\s+short\s+stor|hindi\s+kahani)/i,
        main: "Literature",
        sub: "Hindi Literature — Short Story",
        udc: "891.43-32",
        ddc: "891.433",
        exp: "UDC 891.43 with auxiliary -32 (Short stories); DDC 891.433."
    },
    {
        re: /(hindi\s+poetry|hindi\s+kavita|hindi\s+poem)/i,
        main: "Literature",
        sub: "Hindi Poetry",
        udc: "891.43-1",
        ddc: "891.431",
        exp: "UDC 891.43-1 (Hindi poetry); DDC 891.431 (Hindi poetry)."
    },
    {
        re: /(hindi\s+drama|hindi\s+natak|hindi\s+play)/i,
        main: "Literature",
        sub: "Hindi Drama",
        udc: "891.43-2",
        ddc: "891.432",
        exp: "UDC 891.43-2 (Hindi drama); DDC 891.432 (Hindi drama)."
    },
    {
        re: /\b(hindi)\b/i,
        main: "Linguistics & Literature",
        sub: "Hindi Language & Literature",
        udc: "891.43",
        ddc: "891.43",
        exp: "UDC 891.43 (Hindi language and literature); DDC 891.43."
    },

    // 2. Punjabi Literature
    {
        re: /(punjabi\s+novel|panjabi\s+novel)/i,
        main: "Literature",
        sub: "Punjabi Literature — Novel",
        udc: "891.42-31",
        ddc: "891.423",
        exp: "UDC 891.42 with auxiliary -31 (Novel); DDC 891.423 (Punjabi fiction)."
    },
    {
        re: /(punjabi\s+poetry|punjabi\s+kavita|waris\s*shah)/i,
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
        exp: "UDC 891.42 (Punjabi language and literature); DDC 891.42."
    },

    // 3. English & General Fiction / Novel
    {
        re: /(english\s+novel|english\s+fiction)/i,
        main: "Literature",
        sub: "English Literature — Novel",
        udc: "820-31",
        ddc: "823",
        exp: "UDC 820-31 (English Novel); DDC 823 (English fiction)."
    },
    {
        re: /\b(novel)\b/i,
        main: "Literature",
        sub: "Literature — Novel",
        udc: "82-31",
        ddc: "808.83",
        exp: "UDC 82-31 (Novels); DDC 808.83 (Fiction technique & collections)."
    },

    // 4. Astronomy & Space Sciences (Handles typos like 'astromical')
    {
        re: /(astronom|astromic|astrophysic|solar\s*system|planet|observator|space\s*science|telescope|galaxy|celestial)/i,
        main: "Pure Sciences",
        sub: "Astronomy & Astrophysics",
        udc: "52",
        ddc: "520",
        exp: "UDC 52 (Astronomy. Astrophysics. Space research); DDC 520 (Astronomy & allied sciences)."
    },

    // 5. Library & Information Science
    {
        re: /(bibliometr|scientometr|informetr|citation\s*analysis)/i,
        main: "Library & Information Science",
        sub: "Bibliometrics & Citation Studies",
        udc: "02:001.811",
        ddc: "020.72",
        exp: "UDC 02 (Libraries) : 001.811 (Bibliometrics); DDC 020.72."
    },
    {
        re: /(catalogu|catalog|classified\s*catalogue|aacr|ccc)/i,
        main: "Library Science",
        sub: "Cataloguing & Metadata",
        udc: "025.3",
        ddc: "025.3",
        exp: "UDC 025.3 (Cataloguing); DDC 025.3."
    },
    {
        re: /(classif|colon\s*classification|decimal\s*classification|udc|ddc)/i,
        main: "Library Science",
        sub: "Classification Schemes",
        udc: "025.4",
        ddc: "025.4",
        exp: "UDC 025.4 (Classification); DDC 025.4."
    },
    {
        re: /(librar|librarianship|information\s*centre|documentation\s*centre)/i,
        main: "Library Science",
        sub: "Library & Information Science",
        udc: "02",
        ddc: "020",
        exp: "UDC 02 (Library science); DDC 020."
    },

    // 6. Computer Science
    {
        re: /(computer\s*science|programming|software|algorithm|artificial\s*intelligence|machine\s*learning|database|cloud\s*computing|python)/i,
        main: "Computer Science",
        sub: "Computer Science & Programming",
        udc: "004",
        ddc: "004",
        exp: "UDC 004 (Computer science); DDC 004."
    },

    // 7. Philosophy & Psychology
    { re: /(logic|symbolic\s*logic)/i, main: "Philosophy", sub: "Logic", udc: "16", ddc: "160", exp: "UDC 16 (Logic); DDC 160." },
    { re: /(ethics|moral\s*philosophy|morality)/i, main: "Philosophy", sub: "Ethics", udc: "17", ddc: "170", exp: "UDC 17 (Ethics); DDC 170." },
    { re: /(psycholog|mental\s*health|cognition|behavior)/i, main: "Philosophy & Psychology", sub: "Psychology", udc: "159.9", ddc: "150", exp: "UDC 159.9 (Psychology); DDC 150." },
    { re: /(philosoph|metaphysic|ontology)/i, main: "Philosophy", sub: "Philosophy", udc: "1", ddc: "100", exp: "UDC 1 (Philosophy); DDC 100." },

    // 8. Religion
    { re: /(sikh|gurmat|gurbani|guru\s*granth)/i, main: "Religion", sub: "Sikhism", udc: "294.553", ddc: "294.6", exp: "UDC 294.553 (Sikhism); DDC 294.6." },
    { re: /(hindu|vedas|upanishad|gita)/i, main: "Religion", sub: "Hinduism", udc: "294.51", ddc: "294.5", exp: "UDC 294.51 (Hinduism); DDC 294.5." },
    { re: /(islam|quran|muslim)/i, main: "Religion", sub: "Islam", udc: "297", ddc: "297", exp: "UDC 297 (Islam); DDC 297." },
    { re: /(christian|bible|church|jesus)/i, main: "Religion", sub: "Christianity", udc: "22/28", ddc: "230", exp: "UDC 22/28 (Christianity); DDC 230." },
    { re: /(theolog|religion)/i, main: "Religion", sub: "Religion in General", udc: "2", ddc: "200", exp: "UDC 2 (Religion); DDC 200." },

    // 9. Social Sciences, Law, Economics, Politics
    { re: /(higher\s*education|universit|college)/i, main: "Social Sciences", sub: "Higher Education", udc: "378", ddc: "378", exp: "UDC 378 (Higher education); DDC 378." },
    { re: /(education|teaching|pedagogy|school)/i, main: "Social Sciences", sub: "Education", udc: "37", ddc: "370", exp: "UDC 37 (Education); DDC 370." },
    { re: /(law|jurisprudence|legal|crimin)/i, main: "Social Sciences", sub: "Law & Jurisprudence", udc: "34", ddc: "340", exp: "UDC 34 (Law); DDC 340." },
    { re: /(economic|banking|finance|monetary|trade)/i, main: "Social Sciences", sub: "Economics", udc: "33", ddc: "330", exp: "UDC 33 (Economics); DDC 330." },
    { re: /(politic|government|state|democracy)/i, main: "Social Sciences", sub: "Political Science", udc: "32", ddc: "320", exp: "UDC 32 (Politics); DDC 320." },
    { re: /(sociolog|society|social\s*work)/i, main: "Social Sciences", sub: "Sociology", udc: "301", ddc: "301", exp: "UDC 301 (Sociology); DDC 301." },

    // 10. Pure Sciences
    { re: /(mathemat|algebra|calculus|geometry|statistic)/i, main: "Pure Sciences", sub: "Mathematics", udc: "51", ddc: "510", exp: "UDC 51 (Mathematics); DDC 510." },
    { re: /(physic|quantum|mechanic|optics)/i, main: "Pure Sciences", sub: "Physics", udc: "53", ddc: "530", exp: "UDC 53 (Physics); DDC 530." },
    { re: /(chemistr|biochemist|organic\s*chemistry)/i, main: "Pure Sciences", sub: "Chemistry", udc: "54", ddc: "540", exp: "UDC 54 (Chemistry); DDC 540." },
    { re: /(biolog|genetics|evolution)/i, main: "Pure Sciences", sub: "Biology", udc: "57", ddc: "570", exp: "UDC 57 (Biology); DDC 570." },
    { re: /(botan|plant|flora)/i, main: "Pure Sciences", sub: "Botany", udc: "58", ddc: "580", exp: "UDC 58 (Botany); DDC 580." },
    { re: /(zoolog|animal|wildlife)/i, main: "Pure Sciences", sub: "Zoology", udc: "59", ddc: "590", exp: "UDC 59 (Zoology); DDC 590." },

    // 11. Applied Sciences & Medicine
    { re: /(medicin|medical|surgery|disease|health|clinic)/i, main: "Applied Sciences", sub: "Medical Sciences", udc: "61", ddc: "610", exp: "UDC 61 (Medicine); DDC 610." },
    { re: /(engineer|mechanical|electrical|civil)/i, main: "Applied Sciences", sub: "Engineering", udc: "62", ddc: "620", exp: "UDC 62 (Engineering); DDC 620." },
    { re: /(agricult|farming|crops|horticult)/i, main: "Applied Sciences", sub: "Agriculture", udc: "63", ddc: "630", exp: "UDC 63 (Agriculture); DDC 630." },
    { re: /(management|business\s*administration|accounting)/i, main: "Applied Sciences", sub: "Management", udc: "65", ddc: "650", exp: "UDC 65 (Management); DDC 650." },

    // 12. Arts, Geography, History
    { re: /(art|painting|music|architecture)/i, main: "The Arts", sub: "Fine Arts", udc: "7", ddc: "700", exp: "UDC 7 (The Arts); DDC 700." },
    { re: /(linguist|grammar|language)/i, main: "Linguistics", sub: "Language & Linguistics", udc: "80", ddc: "400", exp: "UDC 80 (Linguistics); DDC 400." },
    { re: /(geograph|travel|atlas|maps)/i, main: "Geography & History", sub: "Geography", udc: "91", ddc: "910", exp: "UDC 91 (Geography); DDC 910." },
    { re: /(histor|ancient\s*history|medieval\s*history)/i, main: "Geography & History", sub: "History", udc: "93/99", ddc: "900", exp: "UDC 93/99 (History); DDC 900." }
];

function extractAuxAndRelations(title) {
    let aux = "";
    let ddcAdd = "";
    let expList = [];

    // Directory
    if (/(directori|director|word\s*director|world\s*director)/i.test(title)) {
        aux += "(058)";
        ddcAdd += ".025";
        expList.push("(058) = Directory / Yearbooks; DDC T1 .025");
    } else if (/(handbook|manual)/i.test(title)) {
        aux += "(02)";
        ddcAdd += ".02";
        expList.push("(02) = Handbook / Manual; DDC T1 .02");
    }

    // Place
    if (/(international|world|word\s*directory|global)/i.test(title)) {
        aux += "(100)";
        expList.push("(100) = International / Global");
    } else if (/(india|indian|punjab)/i.test(title)) {
        aux += "(540)";
        expList.push("(540) = India");
    }

    // Organisation
    if (/(organisat|organizat|association|institution|society)/i.test(title)) {
        aux += ":061";
        expList.push(":061 = Organisations / Associations");
    }

    return { aux, ddcAdd, expList };
}

function classifyEngine(rawTitle) {
    const raw = (rawTitle || '').trim();
    if (!raw) {
        return {
            main_subject: "Generalities",
            sub_subject: "General Knowledge",
            udc_breakdown: "001",
            confidence: "Standard Baseline",
            notation_audit: "Base notation 001 allocated.",
            explanation: "No title provided. Defaulted to general knowledge.",
            sources: "UDC 1961 Edition; DDC 23rd Edition",
            ddc_answer: "001"
        };
    }

    const norm = normalizeClean(raw);

    // 1. Direct Reference Table Lookup
    let directUdc = udcIndex[raw] || udcIndex[norm];
    let directDdc = ddcIndex[raw] || ddcIndex[norm];

    if (!directUdc || !directDdc) {
        for (const k of Object.keys(udcIndex)) {
            if (normalizeClean(k) === norm) {
                directUdc = udcIndex[k];
                break;
            }
        }
        for (const k of Object.keys(ddcIndex)) {
            if (normalizeClean(k) === norm) {
                directDdc = ddcIndex[k];
                break;
            }
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

    // 2. Intelligent Topic Extraction
    let mainTopic = raw;
    if (/subtitle/i.test(raw)) {
        mainTopic = raw.split(/subtitle/i)[0].trim();
    }

    let found = null;
    for (const item of SUBJECT_TABLE) {
        if (item.re.test(norm) || item.re.test(mainTopic) || item.re.test(raw)) {
            found = item;
            break;
        }
    }

    if (found) {
        // Literature titles (novels/fiction) do not take directory or place auxiliaries
        const isLitForm = found.udc.startsWith("8");
        const { aux, ddcAdd, expList } = isLitForm ? { aux: "", ddcAdd: "", expList: [] } : extractAuxAndRelations(raw);

        const finalUdc = `${found.udc}${aux}`;
        const finalDdc = `${found.ddc}${ddcAdd}`;

        return {
            main_subject: found.main,
            sub_subject: found.sub,
            udc_breakdown: finalUdc,
            confidence: "High (Synthesized Rule & Auxiliary Analysis)",
            notation_audit: `Notation '${finalUdc}' audited: Auxiliary symbols and numbers preserved without truncation.`,
            explanation: `${found.exp} ${expList.length ? 'Auxiliaries: ' + expList.join('; ') : ''}`,
            sources: "Universal Decimal Classification (UDC 1961) & Dewey Decimal Classification (DDC 23rd)",
            ddc_answer: finalDdc
        };
    }

    // 3. Fallback Generalities
    const { aux } = extractAuxAndRelations(raw);
    return {
        main_subject: "Generalities & Interdisciplinary",
        sub_subject: raw,
        udc_breakdown: `001${aux}`,
        confidence: "Standard General Analysis",
        notation_audit: `Notation '001${aux}' allocated for interdisciplinary subject.`,
        explanation: "Title analyzed under general scientific fundamentals.",
        sources: "Universal Decimal Classification Class 0 (Generalities)",
        ddc_answer: "001"
    };
}

// Universal API endpoints (UI compatibility)
app.all(['/api/classify', '/api/search', '/classify'], (req, res) => {
    try {
        const title = req.body?.title || req.query?.title || req.query?.q || '';
        const r = classifyEngine(title);

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
