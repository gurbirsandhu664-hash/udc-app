const http = require('http');
const https = require('https');

// Get API Key from Render Environment Variables
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Function to ask DeepSeek AI for UDC/DDC
function getAIClassification(subject, topic) {
    return new Promise((resolve, reject) => {
        const prompt = `You are an expert librarian. Give the most accurate UDC 1961 (Universal Decimal Classification) and DDC 23 (Dewey Decimal Classification) numbers for:
        Subject: ${subject}
        Topic: ${topic}
        
        Respond ONLY in this exact JSON format without any other text:
        {"udc": "number", "ddc": "number", "audit": "short 1 line explanation"}`;

        const postData = JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1
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
                        // Extract JSON from AI response
                        let content = json.choices[0].message.content;
                        // Clean if AI added ```json
                        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
                        const result = JSON.parse(content);
                        resolve(result);
                    } else {
                        reject(new Error("AI did not respond correctly: " + data));
                    }
                } catch (e) {
                    reject(new Error("Error parsing AI response: " + e.message));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

// --- Server Setup ---
const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const subject = url.searchParams.get('subject') || 'Medicine';
    const topic = url.searchParams.get('topic') || 'Aptitude Test';

    let result;
    let errorMsg = "";

    try {
        // Get live answer from AI
        result = await getAIClassification(subject, topic);
    } catch (err) {
        errorMsg = "Error: " + err.message;
        result = { udc: "N/A", ddc: "N/A", audit: "API Error" };
    }

    // --- HTML Design ---
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>DeepSeek UDC/DDC Classifier</title>
            <style>
                body { font-family: Arial, sans-serif; background: #f4f7f6; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; }
                .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); width: 100%; max-width: 500px; }
                h1 { text-align: center; color: #333; margin-bottom: 5px; }
                .subtitle { text-align: center; color: #888; font-size: 14px; margin-bottom: 25px; }
                .input-group { margin-bottom: 15px; }
                label { display: block; margin-bottom: 5px; color: #555; font-weight: bold; }
                input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; font-size: 16px; }
                button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; margin-top: 10px; }
                button:hover { background: #0056b3; }
                .result-box { margin-top: 25px; padding: 20px; background: #e9f7ef; border-left: 5px solid #28a745; border-radius: 6px; }
                .result-item { margin-bottom: 10px; font-size: 16px; }
                .result-item strong { color: #155724; }
                .audit { font-size: 13px; color: #666; margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 10px; }
                .error { color: red; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>DeepSeek AI Classifier</h1>
                <p class="subtitle">Live UDC 1961 & DDC 23 Standard</p>
                
                <form method="GET" action="/">
                    <div class="input-group">
                        <label>Subject (e.g., Medicine, History, Law)</label>
                        <input type="text" name="subject" value="${subject}" required>
                    </div>
                    <div class="input-group">
                        <label>Topic (e.g., Aptitude Test, General)</label>
                        <input type="text" name="topic" value="${topic}" required>
                    </div>
                    <button type="submit">Get Live Classification</button>
                </form>

                <div class="result-box">
                    <div class="result-item"><strong>UDC 1961:</strong> ${result.udc}</div>
                    <div class="result-item"><strong>DDC 23:</strong> ${result.ddc}</div>
                    <div class="audit"><strong>Audit:</strong> ${result.audit}</div>
                    ${errorMsg ? `<div class="error">${errorMsg}</div>` : ''}
                </div>
            </div>
        </body>
        </html>
    `);
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
