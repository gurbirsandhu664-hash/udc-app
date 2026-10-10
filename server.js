const http = require('http');
const https = require('https');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// --- AI Function with Short Audit & Safe Parsing ---
function getAIClassification(query) {
    return new Promise((resolve, reject) => {
        // We added: "Keep the audit VERY SHORT (max 2 lines)."
        const prompt = `You are an expert librarian with deep knowledge of UDC 1961 and DDC 23 classification systems. 
        Analyze the COMPLETE text carefully. Do NOT ignore any word or part of the sentence.
        
        Text to classify: "${query}"
        
        CRITICAL INSTRUCTIONS:
        1. Identify ALL key concepts: Subject, Organization/Institute, Form (Report, Journal, etc.), Place, and Language.
        2. For UDC 1961: You MUST combine the main subject with the Form (e.g., 047.3 for Annual Reports) and Place (e.g., 540 for India) using the correct punctuation. 
        3. For DDC 23: You MUST combine the main subject with the Standard Subdivisions using the correct DDC 23 tables.
        4. Keep the "audit" field VERY SHORT. Maximum 2 lines. Do NOT write a long paragraph.
        
        Respond ONLY in this exact JSON format without any other text:
        {"udc": "number", "ddc": "number", "audit": "short 2 line explanation"}`;

        const postData = JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.0
        });

        const options = {
            hostname: 'api.deepseek.com',
            path: '/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.choices && json.choices[0]) {
                        let content = json.choices[0].message.content;
                        // Clean markdown formatting
                        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
                        
                        // SAFE PARSING: Try to parse JSON safely
                        try {
                            resolve(JSON.parse(content));
                        } catch (parseError) {
                            // If JSON fails, try to extract just the numbers using Regex
                            console.log("JSON Parse failed, trying Regex...");
                            const udcMatch = content.match(/"udc"\s*:\s*"([^"]+)"/);
                            const ddcMatch = content.match(/"ddc"\s*:\s*"([^"]+)"/);
                            const auditMatch = content.match(/"audit"\s*:\s*"([^"]+)"/);
                            
                            if (udcMatch && ddcMatch) {
                                resolve({
                                    udc: udcMatch[1],
                                    ddc: ddcMatch[1],
                                    audit: auditMatch ? auditMatch[1] : "Extracted from AI response."
                                });
                            } else {
                                reject(new Error("Could not parse AI response."));
                            }
                        }
                    } else {
                        reject(new Error("AI did not respond correctly."));
                    }
                } catch (e) {
                    reject(new Error("Network Error: " + e.message));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const query = url.searchParams.get('query') || 'Annual report of Indian institute of public administration';

    let result;
    let errorMsg = "";

    try {
        result = await getAIClassification(query);
    } catch (err) {
        errorMsg = "Error: " + err.message;
        result = { udc: "N/A", ddc: "N/A", audit: "API Error" };
    }

    // --- PROFESSIONAL DESIGN ---
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>DeepSeek AI Classifier</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Inter', sans-serif; background: #f0f2f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
                .card { background: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); width: 100%; max-width: 550px; padding: 40px; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { font-size: 26px; font-weight: 700; color: #1a202c; margin-bottom: 8px; }
                .header p { color: #718096; font-size: 14px; font-weight: 400; }
                .form-group { margin-bottom: 20px; }
                label { display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
                input { width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 16px; transition: all 0.2s; outline: none; font-family: 'Inter', sans-serif; }
                input:focus { border-color: #3182ce; box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1); }
                button { width: 100%; padding: 16px; background: #3182ce; color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.2s; margin-top: 10px; font-family: 'Inter', sans-serif; }
                button:hover { background: #2b6cb0; }
                .result-box { margin-top: 30px; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; }
                .result-item { margin-bottom: 15px; }
                .result-item strong { display: block; font-size: 12px; color: #718096; text-transform: uppercase; margin-bottom: 4px; }
                .result-item span { font-size: 22px; font-weight: 700; color: #2d3748; text-decoration: none; }
                .audit { font-size: 13px; color: #4a5568; margin-top: 20px; padding-top: 15px; border-top: 1px dashed #cbd5e0; line-height: 1.5; }
                .error { color: #e53e3e; font-size: 13px; margin-top: 15px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="header">
                    <h1>DeepSeek AI Classifier</h1>
                    <p>Live UDC 1961 & DDC 23 Standard</p>
                </div>
                
                <form method="GET" action="/" id="classifyForm">
                    <div class="form-group">
                        <label>Enter Your Full Query</label>
                        <input type="text" name="query" placeholder="e.g., Annual report of Indian institute of public administration" value="${query}" required>
                    </div>
                    <button type="submit" id="submitBtn">Get Live Classification</button>
                </form>

                <div class="result-box">
                    <div class="result-item">
                        <strong>UDC 1961</strong>
                        <span>${result.udc}</span>
                    </div>
                    <div class="result-item">
                        <strong>DDC 23</strong>
                        <span>${result.ddc}</span>
                    </div>
                    <div class="audit"><strong>Audit:</strong> ${result.audit}</div>
                    ${errorMsg ? `<div class="error">${errorMsg}</div>` : ''}
                </div>
            </div>

            <script>
                document.getElementById('classifyForm').addEventListener('submit', function() {
                    const btn = document.getElementById('submitBtn');
                    btn.innerHTML = 'Analyzing... ⏳';
                    btn.style.backgroundColor = '#a0aec0';
                    btn.disabled = true;
                });
            </script>
        </body>
        </html>
    `);
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
