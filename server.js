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

const SYLLABUS_SYSTEM_INSTRUCTION = `You are a Senior University Examiner and Expert Classifier in Advanced Library Classification for M.Lib.I.Sc (Course LSP5003).
You must analyze titles and produce classification numbers strictly following:
1. Universal Decimal Classification (UDC 3rd Abridged English Edition BS 1000A:1961).
2. Dewey Decimal Classification (DDC 23rd Edition).

MANDATORY RULES:
- Coordination: Addition sign (+) e.g. Science and Arts = 5+7.
- Consecutive Extension: Slash (/) e.g. 53/54.
- Relationship / Colon: Colon (:) e.g. Foreign relations between India and USA = 327(540:73).
- Common Auxiliaries of Place: India (540), USA (73), Pakistan (549), UK (410).
- Special Auxiliaries: -1/-9 (Literature: English drama = 820-2).
- Library Science: 025.4 (Classification), 025.3 (Cataloguing).
- DDC 23: Complete synthesized notation (e.g. Foreign relations between India and USA = 327.54073).

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

function callGemini(modelName, title) {
    return new Promise((resolve, reject) => {
        if (!GEMINI_API_KEY) return reject(new Error("KEY_EMPTY"));

        const payload = JSON.stringify({
            contents: [{
                parts: [{ text: `${SYLLABUS_SYSTEM_INSTRUCTION}\n\nTitle to Classify: "${title}"\nJSON ONLY:` }]
            }],
            generationConfig: {
                temperature: 0.05,
                responseMimeType: "application/json"
            }
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP_${res.statusCode}`));
                }
                try {
                    const parsed = JSON.parse(data);
                    const text = parsed.candidates[0].content.parts[0].text;
                    resolve(JSON.parse(text));
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

async function smartClassify(title) {
    const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest'];
    let lastErr = null;
    for (const m of models) {
        try {
            const out = await callGemini(m, title);
            out.confidence = `High (Connected via ${m})`;
            return out;
        } catch (err) {
            lastErr = err;
        }
    }
    throw lastErr;
}

function dynamicFallback(title, errReason) {
    const t = (title || '').toLowerCase();
    
    // Dynamic rule for Foreign Relations
    if (t.includes('foreign') || t.includes('relation')) {
        let udcPlace = "(540:73)";
        let ddcNum = "327.54073";
        let sub = "Foreign relations between India and USA";
        
        if (t.includes('pakistan')) {
            udcPlace = "(540:549)";
            ddcNum = "327.540549";
            sub = "Foreign relations between India and Pakistan";
        }
        
        return {
            main_subject: "Political Science / International Relations",
            sub_subject: sub,
            udc_breakdown: `327${udcPlace}`,
            confidence: `Fallback Engine Active (${errReason})`,
            notation_audit: `UDC 327 (Foreign relations) + Auxiliary of Place ${udcPlace}.`,
            explanation: `Processed via dynamic rule. Live Gemini Status: ${errReason}.`,
            sources: "UDC BS 1000A:1961 & DDC 23rd Edition",
            ddc_answer: ddcNum
        };
    }

    return {
        main_subject: "Library & Information Science",
        sub_subject: title,
        udc_breakdown: "025.4",
        confidence: `Fallback Engine Active (${errReason})`,
        notation_audit: "Base schedule allocation.",
        explanation: `API status: ${errReason}. Please check API key project setup.`,
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
            notation_audit: "Base notation 001.",
            explanation: "No title provided.",
            sources: "UDC 1961; DDC 23",
            ddc_answer: "001"
        });
    }

    let result;
    try {
        result = await smartClassify(title);
    } catch (err) {
        result = dynamicFallback(title, err.message);
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
    else res.send("UDC & DDC Classifier is live.");
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
});
