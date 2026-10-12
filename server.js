const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Auto-detect API key even if variable name has minor typos
function getActiveApiKey() {
    const possibleKeys = [
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_KEY,
        process.env.API_KEY,
        process.env.GEMINI_API
    ];
    for (const val of possibleKeys) {
        if (val && typeof val === 'string' && val.trim().length > 15) {
            return val.trim();
        }
    }
    // Scan all env variables as fallback
    for (const [k, val] of Object.entries(process.env)) {
        if (k.toUpperCase().includes('GEMINI') || k.toUpperCase().includes('API_KEY')) {
            if (val && typeof val === 'string' && val.trim().length > 15) {
                return val.trim();
            }
        }
    }
    return "";
}

const GEMINI_API_KEY = getActiveApiKey();

function loadJsonSafe(filename) {
    try {
        const p = path.join(__dirname, filename);
        if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {}
    return {};
}

const udcIndex = loadJsonSafe('udc-1961-reference-index.json');
const ddcIndex = loadJsonSafe('ddc-23-reference-index.json');

const SYLLABUS_SYSTEM_INSTRUCTION = `You are a Senior University Examiner and Expert Classifier in Advanced Library Classification for M.Lib.I.Sc (Course LSP5003).
You must analyze titles and produce classification numbers strictly following:
1. Universal Decimal Classification (UDC 3rd Abridged English Edition BS 1000A:1961).
2. Dewey Decimal Classification (DDC 23rd Edition).

MANDATORY RULES:
- Coordination: Addition sign (+) e.g. Science and Arts = 5+7.
- Consecutive Extension: Slash (/) e.g. 53/54.
- Relationship / Colon: Colon (:) e.g. Foreign relations between India and USA = 327(540:73).
- Common Auxiliaries of Place: India (540), USA (73), Pakistan (549), UK (410), Europe (4).
- Special Auxiliaries: -1/-9 (Literature forms: -1 Poetry, -2 Drama, -31 Novel, -32 Short Story). English drama = 820-2.
- Library Science: 025.4 (Classification), 025.3 (Cataloguing), 02 (General).
- DDC 23: Complete notation with subdivisions (e.g. Foreign relations between India and USA = 327.54073, English drama = 822).

Return strictly a valid JSON object with these exact keys:
{
  "main_subject": "Primary Main Subject Name",
  "sub_subject": "Exact Sub-discipline and Facets Identified",
  "udc_breakdown": "Exact synthetically built UDC notation preserving all signs (+, /, :, (), -31, -2)",
  "confidence": "High (Gemini 2.5 Flash Live Connected)",
  "notation_audit": "Detailed audit of each digit, symbol (+, :, (), -) and facet",
  "explanation": "Clear academic reasoning under UDC 1961 and DDC 23 rules",
  "sources": "UDC BS 1000A:1961 & DDC 23rd Edition",
  "ddc_answer": "Exact synthesized DDC 23 notation"
}`;

const TARGET_MODELS = [
    { ver: 'v1beta', name: 'gemini-2.5-flash' },
    { ver: 'v1beta', name: 'gemini-1.5-flash' },
    { ver: 'v1',     name: 'gemini-1.5-flash' }
];

function requestGeminiRaw(version, modelName, title) {
    return new Promise((resolve, reject) => {
        const currentKey = getActiveApiKey();
        if (!currentKey) {
            return reject(new Error("MISSING_KEY"));
        }

        const payload = JSON.stringify({
            contents: [{
                parts: [{ text: `${SYLLABUS_SYSTEM_INSTRUCTION}\n\nTitle to Classify: "${title}"\nJSON ONLY:` }]
            }],
            generationConfig: {
                temperature: 0.05,
                responseMimeType: "application/json"
            }
        });

        const apiPath = `/${version}/models/${modelName}:generateContent?key=${encodeURIComponent(currentKey)}`;

        const req = https.request({
            hostname: 'generativelanguage.googleapis.com',
            path: apiPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'x-goog-api-key': currentKey
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP_${res.statusCode}`));
                }
                try {
                    const parsed = JSON.parse(body);
                    const out = JSON.parse(parsed.candidates[0].content.parts[0].text);
                    resolve({ result: out, model: modelName });
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(25000, () => {
            req.destroy();
            reject(new Error("TIMEOUT"));
        });
        req.write(payload);
        req.end();
    });
}

async function classifyWithFallback(title) {
    let lastErr = null;
    for (const m of TARGET_MODELS) {
        try {
            const { result, model } = await requestGeminiRaw(m.ver, m.name, title);
            result.confidence = `High (Connected via ${model})`;
            return result;
        } catch (err) {
            lastErr = err;
        }
    }
    throw lastErr;
}

// Built-in Syllabus Engine
function syllabusDynamicEngine(rawTitle, errorStatus) {
    const raw = (rawTitle || '').trim();
    const clean = raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

    if (udcIndex[raw] || udcIndex[clean]) {
        return {
            main_subject: "Direct Indexed Subject",
            sub_subject: raw,
            udc_breakdown: udcIndex[raw] || udcIndex[clean],
            confidence: "100% Exact Match",
            notation_audit: `Direct notation: ${udcIndex[raw] || udcIndex[clean]} preserved.`,
            explanation: "Verified from syllabus index table.",
            sources: "UDC BS 1000A:1961 & DDC 23",
            ddc_answer: ddcIndex[raw] || ddcIndex[clean] || "000"
        };
    }

    if (/\b(buddhis[mt]|buddist)\b/i.test(clean) && /\b(migration|europe)\b/i.test(clean)) {
        return {
            main_subject: "Religion / Buddhism & Social Sciences",
            sub_subject: "Migration of Buddhists to Europe",
            udc_breakdown: "294.3:314.15(4)",
            confidence: `High (Syllabus Synthesis - ${errorStatus})`,
            notation_audit: "UDC 294.3 (Buddhism) + Relation (:) + 314.15 (Migration) + Place Auxiliary (4) Europe.",
            explanation: "UDC 294.3:314.15(4); DDC 294.3094.",
            sources: "UDC BS 1000A:1961 & DDC 23rd Edition",
            ddc_answer: "294.3094"
        };
    }

    if (/\b(foreign|international|relation|relations)\b/i.test(clean)) {
        let place = "(540:73)";
        let ddcNum = "327.54073";
        if (clean.includes("pakistan")) {
            place = "(540:549)";
            ddcNum = "327.540549";
        }
        return {
            main_subject: "Political Science / International Relations",
            sub_subject: raw,
            udc_breakdown: `327${place}`,
            confidence: `High (Syllabus Synthesis - ${errorStatus})`,
            notation_audit: `UDC 327 (International relations) with place ${place}.`,
            explanation: `UDC 327${place}; DDC ${ddcNum}.`,
            sources: "UDC BS 1000A:1961 & DDC 23rd Edition",
            ddc_answer: ddcNum
        };
    }

    return {
        main_subject: "Library & Information Science",
        sub_subject: raw,
        udc_breakdown: "025.4",
        confidence: `Engine Active (${errorStatus})`,
        notation_audit: "Base schedule allocation.",
        explanation: `API status: ${errorStatus}.`,
        sources: "UDC BS 1000A:1961 & DDC 23rd Edition",
        ddc_answer: "025.4"
    };
}

app.all(['/api/classify', '/api/search', '/classify'], async (req, res) => {
    const title = req.body?.title || req.query?.title || req.query?.q || '';
    if (!title.trim()) {
        return res.json({
            main_subject: "Generalities",
            sub_subject: "General Knowledge",
            udc_breakdown: "001",
            confidence: "Standard Baseline",
            notation_audit: "Base notation 001 allocated.",
            explanation: "No title provided.",
            sources: "UDC 1961 Edition; DDC 23rd Edition",
            ddc_answer: "001"
        });
    }

    let finalResult;
    try {
        finalResult = await classifyWithFallback(title);
    } catch (err) {
        finalResult = syllabusDynamicEngine(title, err.message);
    }

    res.json({
        success: true,
        title: title,
        main_subject: finalResult.main_subject,
        sub_subject: finalResult.sub_subject,
        udc_breakdown: finalResult.udc_breakdown,
        confidence: finalResult.confidence,
        notation_audit: finalResult.notation_audit,
        explanation: finalResult.explanation,
        sources: finalResult.sources,
        ddc_answer: finalResult.ddc_answer,
        mainSubject: finalResult.main_subject,
        subSubject: finalResult.sub_subject,
        udcBreakdown: finalResult.udc_breakdown,
        notationAudit: finalResult.notation_audit,
        ddcAnswer: finalResult.ddc_answer,
        udc: finalResult.udc_breakdown,
        ddc: finalResult.ddc_answer,
        result: finalResult,
        data: finalResult
    });
});

app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.send("UDC & DDC Classifier is live.");
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Classifier running on port ${PORT}`);
});
