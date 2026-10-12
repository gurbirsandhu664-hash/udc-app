const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Get API Key from Render Environment
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();

console.log(`[BOOT] Server starting. GEMINI_API_KEY length: ${GEMINI_API_KEY.length}`);

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
- Coordination: When two distinct non-consecutive subjects are linked (e.g. Science and Arts = 5+7, Music and Entertainment = 78+79), use the UDC addition sign (+).
- Consecutive Extension: Use slash (/) (e.g. 53/54).
- Relationship / Colon: Use (:) for subject interaction (e.g. 02:001.811, 929:5).
- Common Auxiliaries of Form: (0...) e.g. Reports (047), Yearbooks (058), Bibliographies (01).
- Common Auxiliaries of Place: (...) e.g. India (540), UK (410), USA (73), Europe and USA (4+73).
- Special Auxiliaries: -1/-9 (Literature forms: -1 Poetry, -2 Drama, -31 Novel, -32 Short Story). For example: English drama = 820-2, English novel = 820-31, Hindi novel = 891.43-31.
- Library Science: Classification = 025.4, Cataloguing = 025.3, General Library Science = 02.
- DDC 23: Complete notation with standard subdivisions from Table 1 and Table 2 (e.g. Library classification = 025.4, English drama = 822, English fiction = 823).

Return strictly a valid JSON object with these exact keys:
{
  "main_subject": "Primary Main Subject Name",
  "sub_subject": "Exact Sub-discipline and Facets Identified",
  "udc_breakdown": "Exact synthetically built UDC notation preserving all signs (+, /, :, (), -31, -2)",
  "confidence": "High (Gemini Live AI Verified)",
  "notation_audit": "Detailed audit of each digit, symbol (+, :, (), -) and facet",
  "explanation": "Clear academic reasoning under UDC 1961 and DDC 23 rules",
  "sources": "UDC BS 1000A:1961 & DDC 23rd Edition",
  "ddc_answer": "Exact synthesized DDC 23 notation"
}`;

function callGoogleGeminiRaw(modelName, title) {
    return new Promise((resolve, reject) => {
        if (!GEMINI_API_KEY) {
            return reject(new Error("API_KEY_IS_EMPTY"));
        }

        const requestBody = JSON.stringify({
            contents: [
                {
                    role: "user",
                    parts: [{ text: `${SYLLABUS_SYSTEM_INSTRUCTION}\n\nTitle to Classify: "${title}"\nReturn JSON ONLY:` }]
                }
            ],
            generationConfig: {
                temperature: 0.05,
                responseMimeType: "application/json"
            }
        });

        const apiPath = `/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

        const req = https.request({
            hostname: 'generativelanguage.googleapis.com',
            path: apiPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody),
                'x-goog-api-key': GEMINI_API_KEY
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    console.error(`[Gemini ${modelName} Error ${res.statusCode}]: ${data}`);
                    return reject(new Error(`HTTP_${res.statusCode}`));
                }
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.candidates && parsed.candidates[0]?.content?.parts?.[0]?.text) {
                        const jsonOutput = JSON.parse(parsed.candidates[0].content.parts[0].text);
                        resolve({ data: jsonOutput, model: modelName });
                    } else {
                        reject(new Error("EMPTY_PARTS"));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.setTimeout(25000, () => {
            req.destroy();
            reject(new Error("TIMEOUT"));
        });
        req.write(requestBody);
        req.end();
    });
}

// 2.5 Flash -> 1.5 Flash resilient chain
async function executeClassificationPipeline(title) {
    // 1. Try 2.5 Flash First
    try {
        console.log(`[API] Trying gemini-2.5-flash for: "${title}"`);
        const result = await callGoogleGeminiRaw('gemini-2.5-flash', title);
        result.data.confidence = "High (Gemini 2.5 Flash Live Connected)";
        return result.data;
    } catch (err25) {
        console.warn(`[API] 2.5-flash failed (${err25.message}). Switching to gemini-1.5-flash...`);
    }

    // 2. Try 1.5 Flash
    try {
        const result = await callGoogleGeminiRaw('gemini-1.5-flash', title);
        result.data.confidence = "High (Gemini 1.5 Flash Live Connected)";
        return result.data;
    } catch (err15) {
        console.warn(`[API] 1.5-flash failed (${err15.message}).`);
        throw err15;
    }
}

// Built-in Academic Engine
function academicSyllabusFallback(rawTitle, errorReason) {
    const raw = (rawTitle || '').trim();
    const clean = raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

    if (udcIndex[raw] || udcIndex[clean]) {
        return {
            main_subject: "Direct Indexed Subject",
            sub_subject: raw,
            udc_breakdown: udcIndex[raw] || udcIndex[clean],
            confidence: "100% Exact Match",
            notation_audit: `Direct notation: ${udcIndex[raw] || udcIndex[clean]} preserved.`,
            explanation: "Verified from reference tables.",
            sources: "UDC BS 1000A:1961 & DDC 23",
            ddc_answer: ddcIndex[raw] || ddcIndex[clean] || "000"
        };
    }

    if (/\b(classification)\b/i.test(clean) && /\b(library|libraries|cataloguing|documentation)\b/i.test(clean)) {
        return {
            main_subject: "Library & Information Science",
            sub_subject: "Library Classification",
            udc_breakdown: "025.4",
            confidence: `Fallback Active (${errorReason})`,
            notation_audit: "UDC Class 025.4 allocated for Classification Schemes.",
            explanation: `Fallback used due to: ${errorReason}. UDC 025.4; DDC 025.4.`,
            sources: "UDC BS 1000A:1961 & DDC 23rd Edition",
            ddc_answer: "025.4"
        };
    }

    if (/\b(english)\b/i.test(clean) && /\b(drama|play|plays)\b/i.test(clean)) {
        return {
            main_subject: "Literature",
            sub_subject: "English Literature — Drama",
            udc_breakdown: "820-2",
            confidence: `Fallback Active (${errorReason})`,
            notation_audit: "UDC 820 (English literature) + Special Auxiliary -2 (Drama)",
            explanation: `UDC 820-2 (English drama); DDC 822 (English drama). Reason: ${errorReason}`,
            sources: "UDC BS 1000A:1961 & DDC 23rd Edition",
            ddc_answer: "822"
        };
    }

    return {
        main_subject: "Disciplinary Synthesis",
        sub_subject: raw,
        udc_breakdown: "025.4",
        confidence: `Fallback Active (${errorReason})`,
        notation_audit: "Processed via academic syllabus engine.",
        explanation: `API status: ${errorReason}. Check Render Environment variable.`,
        sources: "UDC BS 1000A:1961 & DDC 23rd Edition",
        ddc_answer: "025.4"
    };
}

// Main Endpoint
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
        finalResult = await executeClassificationPipeline(title);
    } catch (err) {
        console.error(`[Pipeline Error] Reason: ${err.message}`);
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
