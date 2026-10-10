const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "YOUR_API_KEY_HERE";

async function getUDCFromAI(title) {
    const systemPrompt = `You are an expert librarian specialized in UDC (Universal Decimal Classification) 1961 abridged edition.
Your ONLY job is to provide the EXACT UDC notation for the given title in a detailed report.

STRICT RULES:
1. NEVER make up your own notation. Use ONLY official UDC 1961 abridged edition rules.
2. If a specific auxiliary (like -055.2 for women, (540) for India) is NOT authorized in the 1961 edition, DO NOT add it.
3. Preserve every letter, digit, decimal point, bracket, quote and suffix exactly.
4. NO TRUNCATION. Give complete details.
5. Output ONLY valid JSON in this exact format:
{
  "udc": "number",
  "mainSubject": "short main subject",
  "subSubject": "sub subject / context",
  "breakdown": "detailed UDC notation breakdown and rules used",
  "confidence": "high / medium / low",
  "audit": "notation audit notes"
}`;

    const userPrompt = `Find the exact UDC 1961 Abridged Edition notation with FULL DETAILS for this title: "${title}"`;

    try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.0,
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        const content = data.choices[0].message.content;
        return JSON.parse(content);
    } catch (error) {
        console.error("AI Error:", error);
        return { udc: "ERROR", reason: "API call failed" };
    }
}

// --- GET route (Browser-friendly, full report) ---
app.get('/udc', async (req, res) => {
    const title = req.query.title;
    if (!title) {
        return res.send(`
            <html><body style="font-family:Arial;padding:20px;">
            <h2>UDC 1961 Full Report Tester</h2>
            <form method="GET" action="/udc">
                <input type="text" name="title" placeholder="Enter title here..." style="width:80%;padding:10px;" value="Reading habits of female university teachers in India">
                <button type="submit" style="padding:10px;">Get UDC Report</button>
            </form>
            </body></html>
        `);
    }
    const r = await getUDCFromAI(title);
    res.send(`
        <html><body style="font-family:Arial;padding:20px;background:#f9f9f9;">
        <h2>UDC 1961 Full Report</h2>
        <p><b>Title:</b> ${title}</p>
        <div style="background:#eef;padding:15px;border-radius:8px;">
            <h3>UDC: <span style="color:green;">${r.udc}</span></h3>
            <p><b>Main Subject:</b> ${r.mainSubject || '-'}</p>
            <p><b>Sub Subject:</b> ${r.subSubject || '-'}</p>
            <p><b>Breakdown:</b> ${r.breakdown || '-'}</p>
            <p><b>Confidence:</b> ${r.confidence || '-'}</p>
            <p><b>Audit:</b> ${r.audit || '-'}</p>
        </div>
        <br><a href="/udc">Try another title</a>
        </body></html>
    `);
});

// --- POST routes (API use) ---
app.post('/get-udc', async (req, res) => {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    const r = await getUDCFromAI(title);
    res.json({ title, ...r });
});

app.post('/get-udc-bulk', async (req, res) => {
    const { titles } = req.body;
    if (!titles || !Array.isArray(titles)) return res.status(400).json({ error: "titles array required" });
    const results = [];
    for (let title of titles) {
        const r = await getUDCFromAI(title);
        results.push({ title, ...r });
        await new Promise(r => setTimeout(r, 500));
    }
    res.json(results);
});

app.get('/', (req, res) => {
    res.send('UDC App is running! Go to <a href="/udc">/udc</a> for full report.');
});

app.listen(port, () => {
    console.log(`Server running at port ${port}`);
});
