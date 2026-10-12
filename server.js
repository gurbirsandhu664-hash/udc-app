const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();

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
- Relationship / Colon: Colon (:) e.g. Foreign relations between India and Pakistan = 327(540:549) or 327:954.
- Common Auxiliaries of Place: (...) e.g. India (540), Pakistan (549), UK (410), USA (73).
- Special Auxiliaries: -1/-9 (Literature: English drama = 820-2, English novel = 820-31).
- Library Science: 025.4 (Classification), 025.3 (Cataloguing).
- DDC 23: Complete synthesized notation (e.g. Foreign relations between India and Pakistan = 327.540549).

Return strictly a valid JSON object with these exact keys:
{
  "main_subject": "Primary Main Subject Name",
  "sub_subject": "Exact Sub-discipline and Facets Identified",
  "udc_breakdown": "Exact synthetically built UDC notation preserving all signs (+, /, :, (), -31, -2)",
  "confidence": "High (Gemini AI Live Connected)",
  "notation_audit": "Detailed audit of each digit, symbol (+, :, (), -) and facet",
  "explanation": "Clear academic reasoning under UDC 1961 and DDC 23 rules",
  "sources": "UDC BS 1000A:1961 & DDC 23rd Edition",
  "ddc_answer": "Exact synthesized DDC 23 notation"
}`;

// ਸਾਰੇ ਚਾਲੂ ਮਾਡਲ ਅਤੇ API ਵਰਜਨ ਕੰਬੀਨੇਸ਼ਨ
const ENDPOINT_ATTEMPTS = [
    { ver: 'v1beta', model: 'gemini-2.5-flash' },
    { ver: 'v1beta', model: 'gemini-1.5-flash-latest' },
    { ver: 'v1beta', model: 'gemini-1.5-flash' },
    { ver: 'v1',     model: 'gemini-1.5-flash' },
    { ver: 'v1beta', model: 'gemini-pro' }
];

function sendGeminiRequest(version, model, title) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            contents: [{
                parts: [{ text: `${SYLLABUS_SYSTEM_INSTRUCTION}\n\nTitle to Classify: "${title}"\nReturn JSON ONLY:` }]
            }],
            generationConfig: {
                temperature: 0.05,
                responseMimeType: "application/json"
            }
        });

        const apiPath = `/${version}/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

        const req = https.request({
            hostname: 'generativelanguage.googleapis.com',
            path: apiPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let buffer = '';
            res.on('data', chunk => buffer += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP_${res.statusCode}`));
                }
                try {
                    const parsed = JSON.parse(buffer);
                    const rawText = parsed.candidates[0]?.content?.parts?.[0]?.text;
                    if (!rawText) return reject(new Error("EMPTY_PARTS"));
                    resolve({ result: JSON.parse(rawText), connectedModel: model });
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.setTimeout(20000, () => {
            req.destroy();
            reject(new Error("TIMEOUT"));
        });
        req.write(payload);
        req.end();
    });
}

async function executeClassification(title) {
    if (!GEMINI_API_KEY) throw new Error("MISSING_KEY");

    let lastError = null;
    for (const ep of ENDPOINT_ATTEMPTS) {
        try {
            console.log(`[Connecting] Probing: /${ep.ver}/models/${ep.model}`);
            const { result, connectedModel } = await sendGeminiRequest(ep.ver, ep.model, title);
            result.confidence = `High (Connected via ${connectedModel})`;
            return result;
        } catch (err) {
            console.warn(`[Failed Probe] ${ep.model} (${ep.ver}): ${err.message}`);
            lastError = err;
        }
    }
    throw lastError;
}

function academicSyllabusFallback(rawTitle, errorReason) {
    const raw = (rawTitle || '').trim();
    const clean = raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

    // 1. Direct Index Match
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

    // 2. Foreign relations between India and Pakistan
    if (/\b(foreign|international|relation|relations)\b/i.test(clean) && /\b(india|pakistan)\b/i.test(clean)) {
        return {
            main_subject: "Political Science / International Relations",
            sub_subject: "Foreign relations between India and Pakistan",
            udc_breakdown: "327(540:549)",
            confidence: `High (Syllabus Synthesis - ${errorReason})`,
            notation_audit: "UDC 327 (International relations) + Place Auxiliary (540:549) representing India and Pakistan interaction.",
            explanation: "UDC 327(540:549); DDC 327.540549 (Foreign relations of India with Pakistan).",
            sources: "UDC BS 1000A:1961 & DDC 23rd Edition",
            ddc_answer: "327.540549"
        };
    }

    // 3. Library classification
    if (/\b(classification)\b/i.test(clean) && /\b(library|libraries|cataloguing)\b/i.test(clean)) {
        return {
            main_subject: "Library & Information Science",
            sub_subject: "Library Classification",
            udc_breakdown: "025.4",
            confidence: `Fallback Active (${errorReason})`,
            notation_audit: "UDC Class 025.4 allocated for Classification Schemes.",
            explanation: `Fallback active. UDC 025.4; DDC 025.4.`,
            sources: "UDC BS 1000A:1961 Section A & DDC 23rd Edition",
            ddc_answer: "025.4"
        };
    }

    // Default Fallback
    return {
        main_subject: "Generalities & Complex Synthesis",
        sub_subject: raw,
        udc_breakdown: "001",
        confidence: `Fallback Active (${errorReason})`,
        notation_audit: "Synthesized via syllabus fallback logic.",
        explanation: `API probe returned: ${errorReason}. Verify key permissions.`,
        sources: "UDC BS 1000A:1961 & DDC 23rd Edition",
        ddc_answer: "001"
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
        finalResult = await executeClassification(title);
    } catch (err) {
        console.error(`[Fallback Triggered] Final reason: ${err.message}`);
        finalResult = academicSyllabusFallback(title, err.message);
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
