const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Load optional local tables
function loadJsonSafe(filename) {
    try {
        const p = path.join(__dirname, filename);
        if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {}
    return {};
}

const udcIndex = loadJsonSafe('udc-1961-reference-index.json');
const ddcIndex = loadJsonSafe('ddc-23-reference-index.json');

// M.Lib.I.Sc Master Syllabus Prompt Engine
const SYSTEM_PROMPT = `You are an expert Professor and Examiner in Advanced Library Classification for Master of Library and Information Science (M.Lib.I.Sc) following the syllabus:
- UDC (Universal Decimal Classification, 3rd Abridged English Edition BS 1000A:1961)
- DDC (Dewey Decimal Classification, 23rd Edition)

You must master all 4 syllabus sections:
Section A: Simple titles according to UDC.
Section B: Titles according to UDC Common Auxiliaries:
  - Coordination / Addition: + (e.g., Science and Arts = 5+7, Physics and Chemistry = 53+54)
  - Consecutive extension: / (e.g., 53/54)
  - Relation / Colon: : (e.g., Bibliometrics of Physics = 02:001.811:53)
  - Subgrouping: [ ]
  - Common Auxiliaries of Language: =... (e.g., =914.3 Hindi, =914.2 Punjabi)
  - Common Auxiliaries of Form: (0...) (e.g., (021) Compendium, (038) Dictionary, (047) Report, (058) Directory)
  - Common Auxiliaries of Place: (...) (e.g., (4) Europe, (540) India, (73) USA, (4+73) Europe and USA)
  - Common Auxiliaries of Race and Nationality: (=...) (e.g., (=914.3))
  - Common Auxiliaries of Time: "..." (e.g., "19", "1960/1970")
  - Alphabetical & Non-UDC specification: A/Z or *
Section C: Special Auxiliaries:
  - Hyphen series: -1/-9 (e.g., Literature forms: -1 Poetry, -2 Drama, -3 Prose fiction, -31 Novel, -32 Short story)
  - Point-nought series: .01/.09
  - Apostrophe series: '1/'9 (Synthesis)
Section D: Dewey Decimal Classification (DDC 23rd Edition):
  - 000-999 Main classes with complete Table 1 (Standard Subdivisions), Table 2 (Geographic Areas), Table 3 (Arts & Literature forms), Table 4 (Languages), Table 5 (Ethnic groups), Table 6 (Languages).

Analyze the input title deeply and output STRICT JSON only with keys:
{
  "main_subject": "Primary academic discipline name",
  "sub_subject": "Detailed subject concept and facets",
  "udc_breakdown": "Exact synthetically built notation preserving all symbols (+, /, :, =, (0...), (...), (=...), '...', -1/-9, .0, ') without truncation",
  "confidence": "High (M.Lib.I.Sc Rigorous Classification)",
  "notation_audit": "Detailed explanation of each digit, symbol (+, :, (), -), and auxiliary used",
  "explanation": "Clear academic justification citing specific UDC 1961 and DDC 23 rules",
  "sources": "UDC 3rd Abridged English Edition (BS 1000A:1961) & DDC 23rd Edition",
  "ddc_answer": "Complete DDC 23 notation with Table additions"
}`;

// Gemini 2.5 API Caller
function callGeminiAPI(title) {
    return new Promise((resolve, reject) => {
        if (!GEMINI_API_KEY) {
            return reject(new Error("GEMINI_API_KEY is not configured in Render environment variables."));
        }

        const payload = JSON.stringify({
            contents: [
                {
                    role: "user",
                    parts: [{ text: `${SYSTEM_PROMPT}\n\nTitle to Classify: "${title}"\nOutput JSON only:` }]
                }
            ],
            generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json"
            }
        });

        const req = https.request({
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.candidates && parsed.candidates[0].content.parts[0].text) {
                        const aiJson = JSON.parse(parsed.candidates[0].content.parts[0].text);
                        resolve(aiJson);
                    } else {
                        reject(new Error("Invalid structure from Gemini: " + data));
                    }
                } catch (err) {
                    reject(err);
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error("Gemini API call timed out."));
        });
        req.write(payload);
        req.end();
    });
}

// Offline Syllabus Fallback Engine (Runs if AI key is missing or network times out)
function syllabusOfflineEngine(rawTitle) {
    const raw = (rawTitle || '').trim();
    const clean = raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

    // Direct Index Match
    if (udcIndex[raw] || udcIndex[clean]) {
        return {
            main_subject: "Direct Indexed Subject",
            sub_subject: raw,
            udc_breakdown: udcIndex[raw] || udcIndex[clean],
            confidence: "100% Exact Schedule Match",
            notation_audit: `Direct match: ${udcIndex[raw] || udcIndex[clean]} preserved without truncation.`,
            explanation: "Direct match located in standard reference tables.",
            sources: "UDC BS 1000A:1961 & DDC 23",
            ddc_answer: ddcIndex[raw] || ddcIndex[clean] || "000"
        };
    }

    // Addition (+) Coordination: Science and Arts
    if (/\b(science|sciences)\b/i.test(clean) && /\b(art|arts)\b/i.test(clean) && /\b(and|\+)\b/i.test(clean)) {
        return {
            main_subject: "Pure Sciences & The Arts (Coordinated Subjects)",
            sub_subject: "Sciences and Arts",
            udc_breakdown: "5+7",
            confidence: "High (M.Lib.I.Sc Section B Rule of Coordination)",
            notation_audit: "Notation '5+7': UDC sign of addition (+) joins Class 5 (Science) and Class 7 (Arts).",
            explanation: "UDC Section B Common Auxiliary of Aggregation: The plus sign (+) connects two non-consecutive main classes 5 and 7; DDC 500 & 700.",
            sources: "UDC 1961 BS 1000A Common Auxiliaries & DDC 23",
            ddc_answer: "500 [with 700]"
        };
    }

    // Default synthesis
    return {
        main_subject: "Advanced Classification Synthesis",
        sub_subject: raw,
        udc_breakdown: "001",
        confidence: "Baseline Synthesis",
        notation_audit: "Notation analyzed through structural fallback.",
        explanation: "Provide GEMINI_API_KEY in Render environment variables for full AI-powered analysis.",
        sources: "UDC 1961 & DDC 23rd Edition",
        ddc_answer: "001"
    };
}

// Master API Handler
app.all(['/api/classify', '/api/search', '/classify'], async (req, res) => {
    const title = req.body?.title || req.query?.title || req.query?.q || '';
    if (!title.trim()) {
        return res.json({
            main_subject: "Generalities",
            sub_subject: "General Knowledge",
            udc_breakdown: "001",
            confidence: "Baseline Standard",
            notation_audit: "Base notation 001 allocated.",
            explanation: "No title provided.",
            sources: "UDC 1961 Edition; DDC 23rd Edition",
            ddc_answer: "001"
        });
    }

    let result;
    try {
        result = await callGeminiAPI(title);
    } catch (err) {
        console.log("Gemini API skipped/failed:", err.message, "Using offline syllabus engine.");
        result = syllabusOfflineEngine(title);
    }

    res.json({
        success: true,
        title: title,
        main_subject: result.main_subject,
        sub_subject: result.sub_subject,
        udc_breakdown: result.udc_breakdown,
        confidence: result.confidence,
        notation_audit: result.notation_audit,
        explanation: result.explanation,
        sources: result.sources,
        ddc_answer: result.ddc_answer,
        mainSubject: result.main_subject,
        subSubject: result.sub_subject,
        udcBreakdown: result.udc_breakdown,
        notationAudit: result.notation_audit,
        ddcAnswer: result.ddc_answer,
        udc: result.udc_breakdown,
        ddc: result.ddc_answer,
        result: result,
        data: result
    });
});

app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.send("UDC & DDC M.Lib.I.Sc Classifier is live.");
});

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err.message));
process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
});
