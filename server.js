const http = require('http');

// 1. UDC/DDC Logic for all subjects
function getCorrectClassification(subject, topic) {
    let s = (subject || "").toLowerCase();
    let t = (topic || "").toLowerCase();

    let udc = "N/A", ddc = "N/A", audit = "";

    if (s.includes("medicine") || s.includes("medical")) {
        if (t.includes("aptitude") || t.includes("test") || t.includes("examination")) {
            udc = "61:159.9"; ddc = "610.76";
            audit = "UDC: Used 61 for medicine and 159.9 for aptitude/psychology testing.";
        } else {
            udc = "61"; ddc = "610";
            audit = "UDC: Used 61 for general medicine.";
        }
    } else if (s.includes("education") || s.includes("teaching")) {
        if (t.includes("aptitude") || t.includes("test")) {
            udc = "37.047"; ddc = "370.76";
            audit = "UDC: Used 37.047 for general aptitude tests in education.";
        } else {
            udc = "37"; ddc = "370";
            audit = "UDC: Used 37 for general education.";
        }
    } else {
        udc = "0"; ddc = "000";
        audit = "UDC: General classification used.";
    }
    return { udc, ddc, audit };
}

// 2. Main Website Code (Frontend + Backend)
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    // Get subject and topic from URL (e.g., ?subject=Medicine&topic=Aptitude)
    const url = new URL(req.url, `http://${req.headers.host}`);
    const subject = url.searchParams.get('subject') || 'Medicine';
    const topic = url.searchParams.get('topic') || 'Aptitude Test';

    const result = getCorrectClassification(subject, topic);

    // 3. The HTML Design
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>UDC & DDC Classifier</title>
            <style>
                body { font-family: Arial, sans-serif; background: #f4f7f6; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); width: 90%; max-width: 500px; }
                h1 { text-align: center; color: #333; margin-bottom: 5px; }
                .subtitle { text-align: center; color: #888; font-size: 14px; margin-bottom: 25px; }
                .input-group { margin-bottom: 15px; }
                label { display: block; margin-bottom: 5px; color: #555; font-weight: bold; }
                input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; }
                button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; margin-top: 10px; }
                button:hover { background: #0056b3; }
                .result-box { margin-top: 25px; padding: 20px; background: #e9f7ef; border-left: 5px solid #28a745; border-radius: 6px; }
                .result-item { margin-bottom: 10px; font-size: 16px; }
                .result-item strong { color: #155724; }
                .audit { font-size: 13px; color: #666; margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 10px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>DeepSeek AI Classifier</h1>
                <p class="subtitle">Find UDC and DDC numbers instantly</p>
                
                <form method="GET" action="/">
                    <div class="input-group">
                        <label>Subject (e.g., Medicine)</label>
                        <input type="text" name="subject" value="${subject}" required>
                    </div>
                    <div class="input-group">
                        <label>Topic (e.g., Aptitude Test)</label>
                        <input type="text" name="topic" value="${topic}" required>
                    </div>
                    <button type="submit">Get Classification</button>
                </form>

                <div class="result-box">
                    <div class="result-item"><strong>UDC:</strong> ${result.udc}</div>
                    <div class="result-item"><strong>DDC:</strong> ${result.ddc}</div>
                    <div class="audit"><strong>Audit:</strong> ${result.audit}</div>
                </div>
            </div>
        </body>
        </html>
    `);
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
