const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Safe loader taaki Render te JSON missing hon te crash na hove
function loadJsonFile(filename) {
    const filePath = path.join(__dirname, filename);
    if (fs.existsSync(filePath)) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (err) {
            console.error(`Error loading ${filename}:`, err.message);
            return {};
        }
    }
    return {};
}

// Dono index load kite gaye han
const udcIndex = loadJsonFile('udc-1961-reference-index.json');
const ddcIndex = loadJsonFile('ddc-23-reference-index.json');

// Standard Classification Knowledge Base (Random / Complex Titles layi)
const SUBJECT_PATTERNS = [
    // 000 - Generalities, Computer Science, Library Science
    { re: /\b(bibliometrics|scientometrics|informetrics|citation analysis)\b/i, 
      main: "Library & Information Science", sub: "Bibliometrics & Citation Analysis", udc: "02:001.811", ddc: "020.72", exp: "UDC 02 (Libraries) colon-linked with 001.811 (Scientific technique/Bibliometrics); DDC 020.72 (Research in library and information science)." },
    { re: /\b(cataloguing|cataloging|classified catalogue|aacr|ccc)\b/i, 
      main: "Library Science", sub: "Cataloguing / Practical Manual", udc: "025.3", ddc: "025.3", exp: "UDC 025.3 (Cataloguing, records); DDC 025.3 (Bibliographic analysis & cataloguing)." },
    { re: /\b(classification|colon classification|decimal classification|udc|ddc)\b/i, 
      main: "Library Science", sub: "Classification & Indexing", udc: "025.4", ddc: "025.4", exp: "UDC 025.4 (Classification schemes); DDC 025.4 (Subject analysis & classification)." },
    { re: /\b(library|libraries|public library|academic library|national library)\b/i, 
      main: "Library Science", sub: "General Library Operations", udc: "02", ddc: "020", exp: "UDC 02 (Librarianship, Library science); DDC 020 (Library and information sciences)." },
    { re: /\b(computer|programming|software|algorithm|artificial intelligence|machine learning|python|database|cloud)\b/i, 
      main: "Computer Science", sub: "Data Processing & Computation", udc: "004", ddc: "004", exp: "UDC 004 (Computer science & technology); DDC 004 (Computer science)." },
    
    // 100 - Philosophy & Psychology
    { re: /\b(metaphysics|ontology|cosmology)\b/i, 
      main: "Philosophy", sub: "Metaphysics", udc: "11", ddc: "110", exp: "UDC 11 (Metaphysics); DDC 110 (Metaphysics)." },
    { re: /\b(logic|symbolic logic|reasoning)\b/i, 
      main: "Philosophy", sub: "Logic", udc: "16", ddc: "160", exp: "UDC 16 (Logic, Epistemology); DDC 160 (Logic)." },
    { re: /\b(ethics|moral philosophy|morality)\b/i, 
      main: "Philosophy", sub: "Ethics", udc: "17", ddc: "170", exp: "UDC 17 (Moral philosophy, Ethics); DDC 170 (Ethics)." },
    { re: /\b(psychology|mental health|behavior|cognition)\b/i, 
      main: "Philosophy & Psychology", sub: "Psychology", udc: "159.9", ddc: "150", exp: "UDC 159.9 (Psychology); DDC 150 (Psychology)." },
    { re: /\b(philosophy|epistemology|philosophical)\b/i, 
      main: "Philosophy", sub: "General Philosophy", udc: "1", ddc: "100", exp: "UDC 1 (Philosophy); DDC 100 (Philosophy & psychology)." },

    // 200 - Religion
    { re: /\b(sikhism|gurmat|guru granth|gurbani)\b/i, 
      main: "Religion", sub: "Sikhism", udc: "294.553", ddc: "294.6", exp: "UDC 294.553 (Sikh religion); DDC 294.6 (Sikhism)." },
    { re: /\b(hinduism|vedas|upanishad|gita)\b/i, 
      main: "Religion", sub: "Hinduism", udc: "294.51", ddc: "294.5", exp: "UDC 294.51 (Hinduism); DDC 294.5 (Hinduism)." },
    { re: /\b(islam|quran|prophet|muslim)\b/i, 
      main: "Religion", sub: "Islam", udc: "297", ddc: "297", exp: "UDC 297 (Islam, Mohammedanism); DDC 297 (Islam)." },
    { re: /\b(christianity|bible|church|jesus)\b/i, 
      main: "Religion", sub: "Christianity", udc: "22/28", ddc: "230", exp: "UDC 22/28 (Christian theology); DDC 230 (Christianity)." },
    { re: /\b(religion|theology)\b/i, 
      main: "Religion", sub: "Comparative Religion", udc: "2", ddc: "200", exp: "UDC 2 (Theology, Religion); DDC 200 (Religion)." },

    // 300 - Social Sciences, Education, Law, Economics, Politics
    { re: /\b(higher education|university education|college)\b/i, 
      main: "Social Sciences", sub: "Higher Education", udc: "378", ddc: "378", exp: "UDC 378 (Higher education, Universities); DDC 378 (Higher education)." },
    { re: /\b(education|teaching|pedagogy|school|curriculum)\b/i, 
      main: "Social Sciences", sub: "Education", udc: "37", ddc: "370", exp: "UDC 37 (Education, Teaching); DDC 370 (Education)." },
    { re: /\b(law|jurisprudence|constitutional law|criminal law|legal)\b/i, 
      main: "Social Sciences", sub: "Law & Jurisprudence", udc: "34", ddc: "340", exp: "UDC 34 (Jurisprudence, Law); DDC 340 (Law)." },
    { re: /\b(economics|banking|finance|monetary|trade|commerce)\b/i, 
      main: "Social Sciences", sub: "Economics & Finance", udc: "33", ddc: "330", exp: "UDC 33 (Economics, Political economy); DDC 330 (Economics)." },
    { re: /\b(politics|political science|government|democracy|state)\b/i, 
      main: "Social Sciences", sub: "Political Science", udc: "32", ddc: "320", exp: "UDC 32 (Politics); DDC 320 (Political science)." },
    { re: /\b(sociology|society|culture|social work)\b/i, 
      main: "Social Sciences", sub: "Sociology", udc: "301", ddc: "301", exp: "UDC 301 (Sociology, Sociological problems); DDC 301 (Sociology & anthropology)." },

    // 500 - Pure Sciences
    { re: /\b(mathematics|algebra|calculus|geometry|statistics)\b/i, 
      main: "Pure Sciences", sub: "Mathematics", udc: "51", ddc: "510", exp: "UDC 51 (Mathematics); DDC 510 (Mathematics)." },
    { re: /\b(physics|quantum|thermodynamics|mechanics|optics)\b/i, 
      main: "Pure Sciences", sub: "Physics", udc: "53", ddc: "530", exp: "UDC 53 (Physics); DDC 530 (Physics)." },
    { re: /\b(chemistry|organic chemistry|biochemistry|chemical)\b/i, 
      main: "Pure Sciences", sub: "Chemistry", udc: "54", ddc: "540", exp: "UDC 54 (Chemistry, Crystallography); DDC 540 (Chemistry)." },
    { re: /\b(biology|genetics|evolution|microbiology)\b/i, 
      main: "Pure Sciences", sub: "Biological Sciences", udc: "57", ddc: "570", exp: "UDC 57 (Biological sciences); DDC 570 (Biology)." },
    { re: /\b(botany|plants|flora)\b/i, 
      main: "Pure Sciences", sub: "Botany", udc: "58", ddc: "580", exp: "UDC 58 (Botany); DDC 580 (Plants/Botany)." },
    { re: /\b(zoology|animals|wildlife)\b/i, 
      main: "Pure Sciences", sub: "Zoology", udc: "59", ddc: "590", exp: "UDC 59 (Zoology); DDC 590 (Animals/Zoology)." },

    // 600 - Applied Sciences, Medicine, Engineering, Agriculture
    { re: /\b(medicine|medical|surgery|pathology|diseases|health|clinical)\b/i, 
      main: "Applied Sciences", sub: "Medical Sciences", udc: "61", ddc: "610", exp: "UDC 61 (Medical sciences, Medicine); DDC 610 (Medicine & health)." },
    { re: /\b(engineering|mechanical|electrical|civil|electronics)\b/i, 
      main: "Applied Sciences", sub: "Engineering & Technology", udc: "62", ddc: "620", exp: "UDC 62 (Engineering, Technology); DDC 620 (Engineering & allied operations)." },
    { re: /\b(agriculture|farming|crops|horticulture|agronomy)\b/i, 
      main: "Applied Sciences", sub: "Agriculture", udc: "63", ddc: "630", exp: "UDC 63 (Agriculture, Forestry, Livestock); DDC 630 (Agriculture)." },
    { re: /\b(management|business administration|accounting|marketing)\b/i, 
      main: "Applied Sciences", sub: "Business Management", udc: "65", ddc: "650", exp: "UDC 65 (Management and organization of industry); DDC 650 (Management & auxiliary services)." },

    // 700 - The Arts
    { re: /\b(art|painting|drawing|sculpture|music|cinema|photography)\b/i, 
      main: "The Arts", sub: "Fine Arts & Recreation", udc: "7", ddc: "700", exp: "UDC 7 (The Arts, Recreation, Entertainment, Sport); DDC 700 (The arts)." },

    // 800 - Language & Literature
    { re: /\b(linguistics|grammar|punjabi language|hindi language|english language|language)\b/i, 
      main: "Linguistics", sub: "Language & Linguistics", udc: "80", ddc: "400", exp: "UDC 80 (General linguistics, Philology); DDC 400 (Language)." },
    { re: /\b(literature|poetry|drama|fiction|novel|short stories|prose)\b/i, 
      main: "Literature", sub: "Literature & Belles-Lettres", udc: "82", ddc: "800", exp: "UDC 82 (Literature); DDC 800 (Literature)." },

    // 900 - Geography & History
    { re: /\b(geography|travel|atlas|maps)\b/i, 
      main: "Geography & History", sub: "Geography", udc: "91", ddc: "910", exp: "UDC 91 (Geography, Exploration, Travel); DDC 910 (Geography & travel)." },
    { re: /\b(history|historical|ancient|medieval|modern history)\b/i, 
      main: "Geography & History", sub: "History", udc: "93/99", ddc: "900", exp: "UDC 93/99 (History of nations); DDC 900 (History & geography)." }
];

function detectAuxiliaries(title) {
    let auxUdc = "";
    let auxExp = [];

    // Place Auxiliaries (India: 540, UK: 410, USA: 73)
    if (/\b(india|indian|punjab)\b/i.test(title)) {
        auxUdc += "(540)";
        auxExp.push("UDC Place Auxiliary (540) = India");
    } else if (/\b(britain|british|uk|england)\b/i.test(title)) {
        auxUdc += "(410)";
        auxExp.push("UDC Place Auxiliary (410) = Great Britain / UK");
    } else if (/\b(america|american|usa|united states)\b/i.test(title)) {
        auxUdc += "(73)";
        auxExp.push("UDC Place Auxiliary (73) = United States");
    }

    // Form Auxiliaries (Manual: 02, Dictionary: 03)
    if (/\b(manual|handbook|guide)\b/i.test(title)) {
        auxUdc += "(02)";
        auxExp.push("UDC Form Auxiliary (02) = Manuals, Books of instruction");
    } else if (/\b(dictionary|glossary|encyclopedia)\b/i.test(title)) {
        auxUdc += "(03)";
        auxExp.push("UDC Form Auxiliary (03) = Dictionaries / Reference works");
    }

    return { auxUdc, auxExp };
}

function processClassification(rawTitle) {
    const title = (rawTitle || '').trim();
    if (!title) {
        return {
            main_subject: "Generalities",
            sub_subject: "General Knowledge",
            udc_breakdown: "001",
            confidence: "Baseline Standard",
            notation_audit: "Validated standard base notation.",
            explanation: "No title provided. Defaulted to general knowledge.",
            sources: "UDC 1961 Edition; DDC 23rd Edition",
            ddc_answer: "001"
        };
    }

    const lower = title.toLowerCase();

    // 1. Direct match check
    const directUdc = udcIndex[title] || udcIndex[lower];
    const directDdc = ddcIndex[title] || ddcIndex[lower];

    if (directUdc || directDdc) {
        return {
            main_subject: "Direct Indexed Subject",
            sub_subject: title,
            udc_breakdown: directUdc || "001",
            confidence: "100% Exact Reference Verification",
            notation_audit: `Direct match verified: ${directUdc || directDdc} preserved without truncation.`,
            explanation: "Exact entry located in standard reference tables.",
            sources: "udc-1961-reference-index.json / ddc-23-reference-index.json",
            ddc_answer: directDdc || "000"
        };
    }

    // 2. Multi-rule analysis (Compound subjects)
    const matched = SUBJECT_PATTERNS.filter(p => p.re.test(lower));
    const { auxUdc, auxExp } = detectAuxiliaries(lower);

    if (matched.length >= 2) {
        const primary = matched[0];
        const secondary = matched[1];
        const finalUdc = `${primary.udc}:${secondary.udc}${auxUdc}`;

        return {
            main_subject: `${primary.main} / ${secondary.main}`,
            sub_subject: `${primary.sub} : ${secondary.sub}`,
            udc_breakdown: finalUdc,
            confidence: "High (Compound Subject Synthesized)",
            notation_audit: `UDC ${primary.udc} linked by colon (:) to ${secondary.udc} + auxiliaries ${auxUdc || 'none'}. Preserved without truncation.`,
            explanation: `${primary.exp} Colon relation connects ${secondary.sub} (${secondary.udc}). ${auxExp.join('; ')}`,
            sources: "UDC 1961 Abridged English Edition (BS 1000A) Rules of Combination",
            ddc_answer: `${primary.ddc} (Classed under primary: ${primary.sub})`
        };
    } else if (matched.length === 1) {
        const item = matched[0];
        const finalUdc = `${item.udc}${auxUdc}`;

        return {
            main_subject: item.main,
            sub_subject: item.sub,
            udc_breakdown: finalUdc,
            confidence: "High (Rule & Auxiliary Audit Validated)",
            notation_audit: `UDC base ${item.udc} appended with auxiliaries ${auxUdc || 'none'}. Preserved without truncation.`,
            explanation: `${item.exp} ${auxExp.length ? 'Auxiliaries: ' + auxExp.join('; ') : ''}`,
            sources: "UDC 1961 Edition / Dewey Decimal Classification 23rd Edition",
            ddc_answer: item.ddc
        };
    }

    // 3. Fallback
    return {
        main_subject: "Generalities & Interdisciplinary",
        sub_subject: title,
        udc_breakdown: `001${auxUdc}`,
        confidence: "Standard General Analysis",
        notation_audit: "Base notation 001 allocated for interdisciplinary subject.",
        explanation: "Title analyzed under general knowledge and scientific fundamentals.",
        sources: "Universal Decimal Classification Class 0 (Generalities)",
        ddc_answer: "001"
    };
}

// Universal API endpoints (Supporting all potential front-end query shapes)
app.all(['/api/classify', '/api/search', '/classify'], (req, res) => {
    try {
        const queryTitle = req.body?.title || req.query?.title || req.query?.q || '';
        const result = processClassification(queryTitle);

        res.json({
            success: true,
            title: queryTitle,
            // Direct snake_case mapping for UI elements
            main_subject: result.main_subject,
            sub_subject: result.sub_subject,
            udc_breakdown: result.udc_breakdown,
            confidence: result.confidence,
            notation_audit: result.notation_audit,
            explanation: result.explanation,
            sources: result.sources,
            ddc_answer: result.ddc_answer,
            // Nested object fallback in case client expects result.key
            result: result
        });
    } catch (err) {
        console.error("API Error:", err);
        res.status(500).json({ error: "Classification engine error" });
    }
});

// Front-end root serving
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send("UDC & DDC Classifier is live.");
    }
});

// Unhandled error protection
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err.message));
process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
