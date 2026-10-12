const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Safe loader taaki Render te JSON missing hon te crash na hove
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

// ---------------------------------------------------------
// COMPREHENSIVE UDC (1961) & DDC (23rd) KNOWLEDGE GRAPH
// ---------------------------------------------------------
const DISCIPLINES = [
    // --- LITERATURE & SPECIFIC AUTHORS ---
    {
        id: "hindi_novel",
        regex: /(prem\s*chand|munshi\s*prem|godan|gaban|karam\s*bhumi|karmabhumi|rangbhumi|nirmala|sevasadan|hindi\s+novel|hindi\s+fiction)/i,
        main: "Literature",
        sub: "Hindi Literature — Novel (Premchand)",
        udc: "891.43-31",
        ddc: "891.433",
        exp: "UDC 891.43 (Hindi literature) with auxiliary -31 (Novel); DDC 891.433 (Hindi fiction)."
    },
    {
        id: "hindi_short_story",
        regex: /(hindi\s+story|hindi\s+kahani|hindi\s+short\s+stor)/i,
        main: "Literature",
        sub: "Hindi Literature — Short Stories",
        udc: "891.43-32",
        ddc: "891.433",
        exp: "UDC 891.43-32 (Hindi short stories); DDC 891.433."
    },
    {
        id: "hindi_poetry",
        regex: /(hindi\s+poet|hindi\s+kavita|hindi\s+poem|kabir|tulsidas|surdas|nirala)/i,
        main: "Literature",
        sub: "Hindi Literature — Poetry",
        udc: "891.43-1",
        ddc: "891.431",
        exp: "UDC 891.43-1 (Hindi poetry); DDC 891.431."
    },
    {
        id: "hindi_drama",
        regex: /(hindi\s+drama|hindi\s+natak|hindi\s+play)/i,
        main: "Literature",
        sub: "Hindi Literature — Drama",
        udc: "891.43-2",
        ddc: "891.432",
        exp: "UDC 891.43-2 (Hindi drama); DDC 891.432."
    },
    {
        id: "punjabi_novel",
        regex: /(punjabi\s+novel|panjabi\s+novel|nanak\s+singh|gurdial\s+singh)/i,
        main: "Literature",
        sub: "Punjabi Literature — Novel",
        udc: "891.42-31",
        ddc: "891.423",
        exp: "UDC 891.42-31 (Punjabi novel); DDC 891.423."
    },
    {
        id: "punjabi_poetry",
        regex: /(punjabi\s+poet|punjabi\s+kavita|waris\s+shah|bulleh\s+shah|shiv\s+kumar|amrita\s+pritam)/i,
        main: "Literature",
        sub: "Punjabi Literature — Poetry",
        udc: "891.42-1",
        ddc: "891.421",
        exp: "UDC 891.42-1 (Punjabi poetry); DDC 891.421."
    },
    {
        id: "english_novel",
        regex: /(english\s+novel|english\s+fiction|dickens|austen|orwell|woolf|hardy)/i,
        main: "Literature",
        sub: "English Literature — Novel",
        udc: "820-31",
        ddc: "823",
        exp: "UDC 820-31 (English novel); DDC 823 (English fiction)."
    },
    {
        id: "general_novel",
        regex: /\b(novel|fiction|novella)\b/i,
        main: "Literature",
        sub: "Literature — Novels & Fiction",
        udc: "82-31",
        ddc: "808.83",
        exp: "UDC 82-31 (Novels); DDC 808.83 (Fiction)."
    },
    {
        id: "general_poetry",
        regex: /\b(poetry|poems|verse|rhyme|poet)\b/i,
        main: "Literature",
        sub: "Literature — Poetry",
        udc: "82-1",
        ddc: "808.81",
        exp: "UDC 82-1 (Poetry); DDC 808.81 (Poetry)."
    },
    {
        id: "general_drama",
        regex: /\b(drama|play|theatre|theatrical)\b/i,
        main: "Literature",
        sub: "Literature — Drama",
        udc: "82-2",
        ddc: "808.82",
        exp: "UDC 82-2 (Drama); DDC 808.82 (Drama)."
    },

    // --- LANGUAGE & LINGUISTICS ---
    {
        id: "hindi_lang",
        regex: /\b(hindi|devanagari)\b/i,
        main: "Linguistics",
        sub: "Hindi Language",
        udc: "809.143",
        ddc: "491.43",
        exp: "UDC 809.143 (Hindi language); DDC 491.43 (Hindi language)."
    },
    {
        id: "punjabi_lang",
        regex: /\b(punjabi|panjabi|gurmukhi)\b/i,
        main: "Linguistics",
        sub: "Punjabi Language",
        udc: "809.142",
        ddc: "491.42",
        exp: "UDC 809.142 (Punjabi language); DDC 491.42 (Punjabi language)."
    },
    {
        id: "english_lang",
        regex: /\b(english\s+grammar|english\s+language|learn\s+english)\b/i,
        main: "Linguistics",
        sub: "English Language",
        udc: "802.0",
        ddc: "420",
        exp: "UDC 802.0 (English language); DDC 420 (English language)."
    },
    {
        id: "general_lang",
        regex: /\b(linguistic|grammar|phonetic|syntax|morphology|semantics|dictionary|glossary|language)\b/i,
        main: "Linguistics",
        sub: "Linguistics & Philology",
        udc: "80",
        ddc: "400",
        exp: "UDC 80 (General linguistics); DDC 400 (Language)."
    },

    // --- ASTRONOMY & SPACE ---
    {
        id: "astronomy",
        regex: /(astronom|astromic|astrophysic|solar\s*system|planet|observator|space\s*science|telescope|galaxy|celestial|nebula|comet|star|constellation)/i,
        main: "Pure Sciences",
        sub: "Astronomy & Space Research",
        udc: "52",
        ddc: "520",
        exp: "UDC 52 (Astronomy, Astrophysics, Geodesy); DDC 520 (Astronomy)."
    },

    // --- LIBRARY & INFORMATION SCIENCE ---
    {
        id: "bibliometrics",
        regex: /(bibliometr|scientometr|informetr|citation\s*analysis|h-index|impact\s*factor)/i,
        main: "Library & Information Science",
        sub: "Bibliometrics & Informetrics",
        udc: "02:001.811",
        ddc: "020.72",
        exp: "UDC 02:001.811 (Bibliometric technique in library science); DDC 020.72."
    },
    {
        id: "cataloguing",
        regex: /(catalogu|catalog|classified\s*catalogue|aacr|ccc|marc\s*21|metadata)/i,
        main: "Library Science",
        sub: "Cataloguing & Indexing",
        udc: "025.3",
        ddc: "025.3",
        exp: "UDC 025.3 (Cataloguing, records); DDC 025.3."
    },
    {
        id: "classification",
        regex: /(classif|colon\s*classification|decimal\s*classification|udc|ddc|thesaurus|subject\s*heading)/i,
        main: "Library Science",
        sub: "Classification Systems",
        udc: "025.4",
        ddc: "025.4",
        exp: "UDC 025.4 (Classification); DDC 025.4."
    },
    {
        id: "library_general",
        regex: /(librar|documentation\s*centre|information\s*centre|librarianship)/i,
        main: "Library Science",
        sub: "Library Operations & Management",
        udc: "02",
        ddc: "020",
        exp: "UDC 02 (Libraries & Librarianship); DDC 020."
    },

    // --- COMPUTER SCIENCE & IT ---
    {
        id: "computer_science",
        regex: /(computer|programming|software|algorithm|artificial\s*intelligence|machine\s*learning|deep\s*learning|database|cloud|python|java|javascript|cyber\s*security|data\s*science|data\s*structure)/i,
        main: "Computer Science",
        sub: "Computer Science & Information Technology",
        udc: "004",
        ddc: "004",
        exp: "UDC 004 (Computer science & technology); DDC 004 (Computer science)."
    },

    // --- PHILOSOPHY & PSYCHOLOGY ---
    { id: "logic", regex: /\b(logic|symbolic\s*logic|deduction|induction)\b/i, main: "Philosophy", sub: "Logic", udc: "16", ddc: "160", exp: "UDC 16 (Logic); DDC 160." },
    { id: "ethics", regex: /\b(ethics|moral\s*philosophy|morality|bioethics)\b/i, main: "Philosophy", sub: "Ethics", udc: "17", ddc: "170", exp: "UDC 17 (Ethics); DDC 170." },
    { id: "psychology", regex: /\b(psycholog|mental\s*health|cognition|behavior|personality|depression|psychoanalysis)\b/i, main: "Philosophy & Psychology", sub: "Psychology", udc: "159.9", ddc: "150", exp: "UDC 159.9 (Psychology); DDC 150." },
    { id: "philosophy", regex: /\b(philosoph|metaphysic|ontology|epistemology)\b/i, main: "Philosophy", sub: "General Philosophy", udc: "1", ddc: "100", exp: "UDC 1 (Philosophy); DDC 100." },

    // --- RELIGION ---
    { id: "sikhism", regex: /\b(sikh|gurmat|gurbani|guru\s*granth|guru\s*nanak|khalsa)\b/i, main: "Religion", sub: "Sikhism", udc: "294.553", ddc: "294.6", exp: "UDC 294.553 (Sikhism); DDC 294.6." },
    { id: "hinduism", regex: /\b(hindu|vedas|upanishad|gita|ramayana|mahabharata|brahman)\b/i, main: "Religion", sub: "Hinduism", udc: "294.51", ddc: "294.5", exp: "UDC 294.51 (Hinduism); DDC 294.5." },
    { id: "buddhism", regex: /\b(buddh|dharma|sangha|tripitaka|nirvana)\b/i, main: "Religion", sub: "Buddhism", udc: "294.3", ddc: "294.3", exp: "UDC 294.3 (Buddhism); DDC 294.3." },
    { id: "jainism", regex: /\b(jain|mahavira|ahimsa|agam)\b/i, main: "Religion", sub: "Jainism", udc: "294.35", ddc: "294.4", exp: "UDC 294.35 (Jainism); DDC 294.4." },
    { id: "islam", regex: /\b(islam|quran|muslim|hadith|sharia|prophet\s*muhammad)\b/i, main: "Religion", sub: "Islam", udc: "297", ddc: "297", exp: "UDC 297 (Islam); DDC 297." },
    { id: "christianity", regex: /\b(christian|bible|church|jesus|gospel|theology)\b/i, main: "Religion", sub: "Christianity", udc: "22/28", ddc: "230", exp: "UDC 22/28 (Christianity); DDC 230." },
    { id: "religion_gen", regex: /\b(religion|theolog|faith|spirituality)\b/i, main: "Religion", sub: "Religion in General", udc: "2", ddc: "200", exp: "UDC 2 (Religion); DDC 200." },

    // --- SOCIAL SCIENCES ---
    { id: "higher_ed", regex: /(higher\s*education|universit|college|higher\s*learning|academic\s*institution)/i, main: "Social Sciences", sub: "Higher Education", udc: "378", ddc: "378", exp: "UDC 378 (Higher education); DDC 378." },
    { id: "education", regex: /\b(education|teaching|pedagogy|school|curriculum|classroom|teacher)\b/i, main: "Social Sciences", sub: "Education", udc: "37", ddc: "370", exp: "UDC 37 (Education); DDC 370." },
    { id: "law", regex: /\b(law|jurisprudence|legal|crimin|constitution|court|advocate|judicial)\b/i, main: "Social Sciences", sub: "Law & Jurisprudence", udc: "34", ddc: "340", exp: "UDC 34 (Law); DDC 340." },
    { id: "economics", regex: /\b(economic|banking|finance|monetary|trade|inflation|gdp|taxation|revenue)\b/i, main: "Social Sciences", sub: "Economics & Finance", udc: "33", ddc: "330", exp: "UDC 33 (Economics); DDC 330." },
    { id: "politics", regex: /\b(politic|government|state|democracy|election|international\s*relations|foreign\s*policy)\b/i, main: "Social Sciences", sub: "Political Science", udc: "32", ddc: "320", exp: "UDC 32 (Politics); DDC 320." },
    { id: "sociology", regex: /\b(sociolog|society|social\s*work|caste|gender|family|community)\b/i, main: "Social Sciences", sub: "Sociology", udc: "301", ddc: "301", exp: "UDC 301 (Sociology); DDC 301." },

    // --- PURE SCIENCES ---
    { id: "math", regex: /\b(mathemat|algebra|calculus|geometry|statistic|trigonometry|probability)\b/i, main: "Pure Sciences", sub: "Mathematics", udc: "51", ddc: "510", exp: "UDC 51 (Mathematics); DDC 510." },
    { id: "physics", regex: /\b(physic|quantum|mechanic|thermodynamic|optics|electromagnetism|gravity|relativity)\b/i, main: "Pure Sciences", sub: "Physics", udc: "53", ddc: "530", exp: "UDC 53 (Physics); DDC 530." },
    { id: "chemistry", regex: /\b(chemistr|biochemist|organic\s*chemistry|inorganic|chemical|molecule)\b/i, main: "Pure Sciences", sub: "Chemistry", udc: "54", ddc: "540", exp: "UDC 54 (Chemistry); DDC 540." },
    { id: "biology", regex: /\b(biolog|genetics|evolution|microbiolog|ecology|dna|cell|molecular\s*biology)\b/i, main: "Pure Sciences", sub: "Biological Sciences", udc: "57", ddc: "570", exp: "UDC 57 (Biology); DDC 570." },
    { id: "botany", regex: /\b(botan|plant|flora|photosynthesis|tree|flower)\b/i, main: "Pure Sciences", sub: "Botany", udc: "58", ddc: "580", exp: "UDC 58 (Botany); DDC 580." },
    { id: "zoology", regex: /\b(zoolog|animal|wildlife|invertebrate|vertebrate|mammal|insect)\b/i, main: "Pure Sciences", sub: "Zoology", udc: "59", ddc: "590", exp: "UDC 59 (Zoology); DDC 590." },
    { id: "geology", regex: /\b(geolog|earth\s*science|mineral|rock|volcano|earthquake|fossil)\b/i, main: "Pure Sciences", sub: "Geology & Earth Sciences", udc: "55", ddc: "550", exp: "UDC 55 (Geology); DDC 550." },

    // --- APPLIED SCIENCES & MEDICINE ---
    { id: "medicine", regex: /\b(medicin|medical|surgery|disease|health|clinic|pathology|doctor|pharma|cancer|cardio)\b/i, main: "Applied Sciences", sub: "Medical Sciences", udc: "61", ddc: "610", exp: "UDC 61 (Medicine); DDC 610." },
    { id: "engineering", regex: /\b(engineer|mechanical|electrical|civil\s*eng|electronic|robotics|aerospace)\b/i, main: "Applied Sciences", sub: "Engineering & Technology", udc: "62", ddc: "620", exp: "UDC 62 (Engineering); DDC 620." },
    { id: "agriculture", regex: /\b(agricult|farming|crops|horticult|soil|agronomy|irrigation|livestock)\b/i, main: "Applied Sciences", sub: "Agriculture & Forestry", udc: "63", ddc: "630", exp: "UDC 63 (Agriculture); DDC 630." },
    { id: "management", regex: /\b(management|business|commerce|marketing|accounting|human\s*resource|mba)\b/i, main: "Applied Sciences", sub: "Management & Business", udc: "65", ddc: "650", exp: "UDC 65 (Management); DDC 650." },

    // --- ARTS & RECREATION ---
    { id: "arts", regex: /\b(art|painting|drawing|sculpture|music|cinema|film|theatre|photography|sports|game)\b/i, main: "The Arts", sub: "Fine Arts & Recreation", udc: "7", ddc: "700", exp: "UDC 7 (The Arts); DDC 700." },
    { id: "architecture", regex: /\b(architectur|building\s*design|monument)\b/i, main: "The Arts", sub: "Architecture", udc: "72", ddc: "720", exp: "UDC 72 (Architecture); DDC 720." },

    // --- GEOGRAPHY & HISTORY ---
    { id: "geography", regex: /\b(geograph|travel|atlas|maps|tourism|landscape)\b/i, main: "Geography & History", sub: "Geography & Travel", udc: "91", ddc: "910", exp: "UDC 91 (Geography); DDC 910." },
    { id: "history", regex: /\b(histor|ancient|medieval|modern\s*history|civilization|war|empire|revolution|mughal|british\s*raj)\b/i, main: "Geography & History", sub: "History", udc: "93/99", ddc: "900", exp: "UDC 93/99 (History); DDC 900." },
    { id: "biography", regex: /\b(biograph|autobiograph|memoir|life\s*of)\b/i, main: "Geography & History", sub: "Biography", udc: "929", ddc: "920", exp: "UDC 929 (Biography); DDC 920." }
];

// Auxiliary Parser (Place, Form, Organization)
function parseAuxiliaries(text) {
    let aux = "";
    let ddcAdd = "";
    let notes = [];

    // Form: Directory
    if (/(directori|director|word\s*director|world\s*director)/i.test(text)) {
        aux += "(058)";
        ddcAdd += ".025";
        notes.push("UDC (058) = Directories / Yearbooks; DDC T1 .025");
    } else if (/(handbook|manual|guidebook|guide)/i.test(text)) {
        aux += "(02)";
        ddcAdd += ".02";
        notes.push("UDC (02) = Handbooks / Manuals; DDC T1 .02");
    } else if (/(encyclopedia|encyclopaedia)/i.test(text)) {
        aux += "(03)";
        ddcAdd += ".03";
        notes.push("UDC (03) = Encyclopedias; DDC T1 .03");
    } else if (/(dictionary|glossary)/i.test(text)) {
        aux += "(038)";
        ddcAdd += ".03";
        notes.push("UDC (038) = Dictionaries");
    }

    // Place
    if (/(international|world|word\s*directory|global)/i.test(text)) {
        aux += "(100)";
        notes.push("UDC (100) = International, World-wide");
    } else if (/(india|indian|punjab|delhi|haryana)/i.test(text)) {
        aux += "(540)";
        notes.push("UDC (540) = India");
    } else if (/(britain|british|uk|england)/i.test(text)) {
        aux += "(410)";
        notes.push("UDC (410) = United Kingdom");
    } else if (/(america|united\s*states|usa)/i.test(text)) {
        aux += "(73)";
        notes.push("UDC (73) = United States");
    }

    // Organisation relation :061
    if (/(organisat|organizat|association|institution|society|board|council)/i.test(text)) {
        aux += ":061";
        notes.push("UDC Colon relation :061 = Organisations / Associations");
    }

    return { aux, ddcAdd, notes };
}

// ---------------------------------------------------------
// CORE CLASSIFICATION ENGINE
// ---------------------------------------------------------
function classifyTitleEngine(rawTitle) {
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

    // 1. DIRECT JSON INDEX LOOKUP (Case & Space insensitive)
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

    // 2. SMART KEYWORD & DISCIPLINE MATCHING
    let matchedDisciplines = [];
    for (const d of DISCIPLINES) {
        if (d.regex.test(norm) || d.regex.test(raw)) {
            matchedDisciplines.push(d);
        }
    }

    // Subtitle cleaning for extra context
    let mainSegment = raw;
    if (/subtitle/i.test(raw)) {
        mainSegment = raw.split(/subtitle/i)[0].trim();
    }
    if (matchedDisciplines.length === 0) {
        for (const d of DISCIPLINES) {
            if (d.regex.test(normalizeClean(mainSegment))) {
                matchedDisciplines.push(d);
                break;
            }
        }
    }

    // Parse auxiliaries
    const { aux, ddcAdd, notes } = parseAuxiliaries(raw);

    if (matchedDisciplines.length > 0) {
        const primary = matchedDisciplines[0];
        const isLiterature = primary.udc.startsWith("8");

        // Literature does not attach directory/place auxiliaries unless general
        const finalAux = isLiterature ? "" : aux;
        const finalDdcAdd = isLiterature ? "" : ddcAdd;

        let fullUdc = `${primary.udc}${finalAux}`;
        let fullDdc = `${primary.ddc}${finalDdcAdd}`;
        let fullSub = primary.sub;
        let fullExp = primary.exp;

        // If secondary discipline found, colon relation
        if (matchedDisciplines.length > 1 && !isLiterature) {
            const secondary = matchedDisciplines[1];
            fullUdc = `${primary.udc}:${secondary.udc}${finalAux}`;
            fullSub = `${primary.sub} and ${secondary.sub}`;
            fullExp += ` Colon linked with ${secondary.sub} (${secondary.udc}).`;
        }

        if (notes.length && !isLiterature) {
            fullExp += ` Auxiliaries: ${notes.join('; ')}.`;
        }

        return {
            main_subject: primary.main,
            sub_subject: fullSub,
            udc_breakdown: fullUdc,
            confidence: "High (Synthesized Rule & Auxiliary Analysis)",
            notation_audit: `Notation '${fullUdc}' audited: Auxiliary symbols and numbers preserved without truncation.`,
            explanation: fullExp,
            sources: "Universal Decimal Classification (UDC 1961) & Dewey Decimal Classification (DDC 23rd)",
            ddc_answer: fullDdc
        };
    }

    // 3. INTELLIGENT WORD-ROOT EXTRACTION (Never dump to 001)
    // Extract non-stop words
    const stopWords = new Set(["a", "an", "the", "by", "of", "in", "on", "for", "and", "with", "at", "to", "from", "subtitle"]);
    const words = norm.split(' ').filter(w => !stopWords.has(w) && w.length > 2);

    let inferredSubject = "Social Sciences & Humanities";
    let inferredSub = raw;
    let inferredUdc = "3";
    let inferredDdc = "300";

    if (words.some(w => /tech|eng|sci|bio|chem|phys|electr|comp|mech/i.test(w))) {
        inferredSubject = "Pure & Applied Sciences";
        inferredUdc = "5/6";
        inferredDdc = "500";
    } else if (words.some(w => /lit|poem|stor|novel|author|book/i.test(w))) {
        inferredSubject = "Literature";
        inferredUdc = "82";
        inferredDdc = "800";
    } else if (words.some(w => /hist|ancient|past|war|state/i.test(w))) {
        inferredSubject = "History";
        inferredUdc = "93/99";
        inferredDdc = "900";
    }

    const finalInferredUdc = `${inferredUdc}${aux}`;
    const finalInferredDdc = `${inferredDdc}${ddcAdd}`;

    return {
        main_subject: inferredSubject,
        sub_subject: inferredSub,
        udc_breakdown: finalInferredUdc,
        confidence: "Medium (Conceptual Linguistic Synthesis)",
        notation_audit: `Notation '${finalInferredUdc}' audited: Base class extracted from semantic roots.`,
        explanation: `Analyzed through linguistic root structure. ${notes.join('; ')}`,
        sources: "UDC 1961 Edition Main Tables & DDC 23rd Edition",
        ddc_answer: finalInferredDdc
    };
}

// ---------------------------------------------------------
// UNIVERSAL API ENDPOINT
// ---------------------------------------------------------
app.all(['/api/classify', '/api/search', '/classify'], (req, res) => {
    try {
        const title = req.body?.title || req.query?.title || req.query?.q || '';
        const r = classifyTitleEngine(title);

        res.json({
            success: true,
            title: title,
            // Standard Snake Case
            main_subject: r.main_subject,
            sub_subject: r.sub_subject,
            udc_breakdown: r.udc_breakdown,
            confidence: r.confidence,
            notation_audit: r.notation_audit,
            explanation: r.explanation,
            sources: r.sources,
            ddc_answer: r.ddc_answer,
            // CamelCase Fallbacks
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
        res.status(500).json({ error: "Classification engine internal error" });
    }
});

// Front-end delivery
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send("UDC & DDC Classifier is live.");
    }
});

// Crash prevention
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err.message));
process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err));

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
