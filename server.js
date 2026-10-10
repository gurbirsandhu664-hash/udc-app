const http = require('http');

// 1. UDC 1961 & DDC 23 Logic for all subjects
function getCorrectClassification(subject, topic) {
    let s = (subject || "").toLowerCase();
    let t = (topic || "").toLowerCase();

    let udc = "N/A", ddc = "N/A", audit = "";

    // --- MEDICINE ---
    if (s.includes("medicine") || s.includes("medical") || s.includes("health")) {
        if (t.includes("aptitude") || t.includes("test") || t.includes("examination")) {
            udc = "61:159.9"; // Medicine + Psychology
            ddc = "610.76";   // Medicine + Tests
            audit = "UDC 1961: Used 61 for medicine and 159.9 for aptitude/psychology testing. DDC 23: Used 610 for medicine and .76 for examinations.";
        } else {
            udc = "61";
            ddc = "610";
            audit = "UDC 1961: Used 61 for general medicine. DDC 23: Used 610 for general medicine.";
        }
    } 
    // --- SCIENCE ---
    else if (s.includes("science")) {
        if (t.includes("aptitude") || t.includes("test")) {
            udc = "5:159.9"; // Science + Psychology
            ddc = "507.6";   // Science + Tests
            audit = "UDC 1961: Used 5 for science and 159.9 for aptitude testing. DDC 23: Used 507 for science education and .6 for tests.";
        } else {
            udc = "5";
            ddc = "500";
            audit = "UDC 1961: Used 5 for general science. DDC 23: Used 500 for general science.";
        }
    }
    // --- EDUCATION ---
    else if (s.includes("education") || s.includes("teaching")) {
        if (t.includes("aptitude") || t.includes("test")) {
            udc = "37.047";
            ddc = "370.76";
            audit = "UDC 1961: Used 37.047 for general aptitude tests in education. DDC 23: Used 370.76 for educational tests.";
        } else {
            udc = "37";
            ddc = "370";
            audit = "UDC 1961: Used 37 for general education. DDC 23: Used 370 for general education.";
        }
    }
    // --- COMPUTER SCIENCE ---
    else if (s.includes("computer") || s.includes("it") || s.includes("technology")) {
        if (t.includes("aptitude") || t.includes("test")) {
            udc = "004:159.9";
            ddc = "004.076";
            audit = "UDC 1961: Used 004 for computer science and 159.9 for aptitude. DDC 23: Used 004.076 for computer science tests.";
        } else {
            udc = "004";
            ddc = "004";
            audit = "UDC 1961: Used 004 for computer science. DDC 23: Used 004 for computer science.";
        }
    }
    // --- GENERAL FALLBACK ---
    else {
        udc = "0"; 
        ddc = "000";
        audit = "UDC 1961: General classification used. (Subject not specifically matched).";
    }
    
    return { udc, ddc, audit };
}

// 2. Main Website Code (Frontend + Backend)
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
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
            <title>UDC 1961 & DDC 23 Classifier</title>
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
            </style>
        </head>
        <body>
            <div class="card">
                <h1>DeepSeek AI Classifier</h1>
                <p class="subtitle">UDC 1961 & DDC 23 Standard</p>
                
                <form method="GET" action="/">
                    <div class="input-group">
                        <label>Subject (e.g., Medicine, Science, Education)</label>
                        <input type="text" name="subject" value="${subject}" required>
                    </div>
                    <div class="input-group">
                        <label>Topic (e.g., Aptitude Test, General)</label>
                        <input type="text" name="topic" value="${topic}" required>
                    </div>
                    <button type="submit">Get Classification</button>
                </form>

                <div class="result-box">
                    <div class="result-item"><strong>UDC 1961:</strong> ${result.udc}</div>
                    <div class="result-item"><strong>DDC 23:</strong> ${result.ddc}</div>
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
