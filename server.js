const http = require('http');
const https = require('https');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// --- MLISc LEVEL SMART AI FUNCTION ---
function getAIClassification(query) {
    return new Promise((resolve, reject) => {
        // PROFESSIONAL PROMPT FOR MLISC (UDC 1961 + DDC 23)
        const prompt = `You are a highly intelligent librarian with deep, strict knowledge of UDC 1961 (Abridged Edition) and DDC 23 classification rules.
        You are specifically trained for the Master of Library and Information Science (MLISc) exam pattern.
        
        Text to classify: "${query}"
        
        CRITICAL RULES (Follow strictly for Exam Standard):
        
        --- FOR UDC 1961 ---
        1. Apply Common Auxiliaries correctly:
           - Language: = (e.g., =214.21 for Hindi)
           - Form: (0...) (e.g., (047.3) for Annual Reports)
           - Place: (1/9) (e.g., (540) for India)
           - Race/Nationality: (=...) 
           - Time: "..." 
           - Point of View: .00
           - Materials: -03
           - Relation: : (e.g., 61:37 for Medicine and Education)
           - Addition: + (e.g., 622+669 for Mining and Metallurgy)
           - Extension: / (e.g., 592/599 for Invertebrates)
           - Grouping: [] (e.g., 63:636[633.1:636.5])
           
        2. Apply Special Auxiliaries correctly:
           - Hyphen series: -1/-9 (e.g., -31 for Novel)
           - Point Zero series: .01/.09 (e.g., .047.3 for Report)
           - Apostrophe series: '1/'9 (e.g., '373.72 for Idioms)
           
        3. For Hindi Literature: Use 891.43 (Hindi) + -31 (Novel) + '373.72 (Idioms if applicable). If author is Prem Chand, append PRE.
        
        --- FOR DDC 23 ---
        1. Apply Standard Subdivisions correctly:
           - -01 to -09 (e.g., -05 for Serial Publications, -09 for History)
           - Area Notation: -1/-9 (e.g., -54 for India)
           - Language: -1/-9 (e.g., -914.3 for Hindi)
           - Race: -1/-9
           
        2. Apply Multiple Syntheses correctly:
           - Use T1--T9 tables for complex subjects.
           - For Hindi Fiction: Use 891.433 (Hindi fiction) and NOT 891.4335.
           - For Report: Use -05 as standard subdivision if needed.
        
        IMPORTANT: Be precise. If the exact number doesn't exist, give the closest valid UDC/DDC number according to the official schedule.
        
        Respond ONLY in this exact JSON format without any other text:
        {"udc": "number", "ddc": "number", "audit": "short 2 line explanation of auxiliaries used"}`;

        const postData = JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.0 // Maximum accuracy
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
                        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
                        
                        // SAFE PARSING
                        try {
                            resolve(JSON.parse(content));
                        } catch (parseError) {
                            // Regex Fallback
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
    const query = url.searchParams.get('query') || 'karam bhumi a Hindi novel by prem chand';

    let result;
    let errorMsg = "";

    try {
        result = await getAIClassification(query);
    } catch (err) {
        errorMsg = "Error: " + err.message;
        result = { udc: "N/A", ddc: "N/A", audit: "API Error" };
    }

    // --- ADVANCED PROFESSIONAL DESIGN ---
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>DeepSeek AI Classifier</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Inter', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
                .card { background: #ffffff; border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); width: 100%; max-width: 580px; padding: 45px; transition: all 0.3s ease; }
                .card:hover { transform: translateY(-5px); box-shadow: 0 25px 50px rgba(0,0,0,0.25); }
                
                .header { text-align: center; margin-bottom: 35px; }
                .header h1 { font-size: 28px; font-weight: 700; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 10px; }
                .header p { color: #718096; font-size: 14px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; }
                
                .form-group { margin-bottom: 25px; }
                label { display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
                input { width: 100%; padding: 16px 18px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 16px; transition: all 0.3s; outline: none; font-family: 'Inter', sans-serif; background: #f8fafc; }
                input:focus { border-color: #667eea; box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.15); background: #ffffff; }
                
                button { width: 100%; padding: 18px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s; margin-top: 10px; font-family: 'Inter', sans-serif; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); }
                button:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5); }
                button:active { transform: translateY(0); }
                
                .result-box { margin-top: 35px; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 16px; padding: 30px; }
                .result-item { margin-bottom: 20px; }
                .result-item strong { display: block; font-size: 12px; color: #718096; text-transform: uppercase; margin-bottom: 6px; font-weight: 600; letter-spacing: 1px; }
                .result-item span { font-size: 24px; font-weight: 700; color: #1a202c; text-decoration: none; font-family: 'Inter', sans-serif; }
                .audit { font-size: 14px; color: #4a5568; margin-top: 25px; padding-top: 20px; border-top: 2px dashed #cbd5e0; line-height: 1.6; }
                .error { color: #e53e3e; font-size: 14px; margin-top: 20px; text-align: center; font-weight: 500; }
                
                @media (max-width: 480px) {
                    .card { padding: 30px 20px; }
                    .header h1 { font-size: 24px; }
                }
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
                        <input type="text" name="query" placeholder="e.g., Karam Bhumi a Hindi novel by Prem Chand" value="${query}" required>
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
                    btn.style.background = '#a0aec0';
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
