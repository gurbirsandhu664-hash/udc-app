const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "YOUR_API_KEY_HERE";

// --- DDC 23 Rules (from the official PDF) ---
const DDC_RULES = `
DDC 23 RULES (from the official PDF):
- 028 = Reading and use of other information media
- 028.9 = Reading interests and habits
- 070 = News media, journalism, publishing
- 371.26 = Examinations and tests, aptitude testing
- 371.2 = School administration
- 378 = Higher education
- 305 = Groups of people
- 305.4 = Women
- 305.9 = People by occupation
- 610 = Medicine and health
- 610.76 = Medicine - examinations, tests
- 371.26 = Examinations and tests
- 371.264 = Academic prognosis and placement
`;

// --- UDC 1961 Rules ---
const UDC_RULES = `
UDC 1961 ABRIDGED EDITION RULES:
- 028 = Reading and advice for readers
- 028.9 = Reading interests and habits
- 05 = Serial publications / Newspapers / Journalism
- 37 = Education
- 37.047 = Educational testing / aptitude tests
- 378 = Higher education / Universities
- -055.2 = Women (authorized auxiliary in 1961 abridged edition)
- (540) = India (authorized common auxiliary of place)
- Colon (:) = Relation indicator
- Always give the SHORTEST correct UDC number
- If title mentions newspaper/article/journal, add 05 using colon.
`;

async function getClassification(title) {
    const systemPrompt = `You are a senior Library Science professor and cataloguer.
You must give 100% accurate classification using UDC 1961 Abridged Edition AND DDC 23.

=== UDC 1961 RULES ===
${UDC_RULES}

=== DDC 23 RULES ===
${DDC_RULES}

=== DUAL CLASSIFIER OUTPUT RULES ===
- Provide BOTH UDC 1961 and DDC 23 numbers for every title.
- Be 100% accurate. Do not guess. Do not add unauthorized auxiliaries.
- Output must be complete JSON with no truncation.

STRICT OUTPUT FORMAT (JSON only):
{
  "udc": "full UDC 1961 number",
  "ddc": "full DDC 23 number",
  "mainSubject": "short main subject",
  "subSubject": "sub subject / context",
  "udcBreakdown": "detailed UDC notation breakdown",
  "ddcBreakdown": "detailed DDC 23 breakdown",
  "confidence": "high / medium / low",
  "audit": "notation audit notes for both UDC and DDC",
  "newspaperArticle": true or false,
  "newspaperNumberUDC": "UDC 05 code if applicable, otherwise N/A",
  "newspaperNumberDDC": "DDC 070 code if applicable, otherwise N/A"
}`;

    const userPrompt = `Find BOTH the exact UDC 1961 Abridged Edition notation AND DDC 23 notation with FULL DETAILS for this title: "${title}".
If this title is a newspaper article or published in a newspaper/journal, include the UDC 05 code and the DDC 070 code.
Output must be complete JSON.`;

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
        return {
            udc: "ERROR", ddc: "ERROR", mainSubject: "-", subSubject: "-",
            udcBreakdown: "API call failed", ddcBreakdown: "API call failed",
            confidence: "low", audit: "API call failed",
            newspaperArticle: false, newspaperNumberUDC: "N/A", newspaperNumberDDC: "N/A"
        };
    }
}

// --- Browser-friendly route ---
app.get('/udc', async (req, res) => {
    const title = req.query.title;
    if (!title) {
        return res.send(`
            <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
            <body style="font-family:Arial;padding:20px;background:#f4f4f4;">
            <h2>Dual Classifier (UDC 1961 + DDC 23)</h2>
            <form method="GET" action="/udc">
                <input type="text" name="title" placeholder="Enter title here..." style="width:80%;padding:10px;font-size:16px;" value="Reading habits of female university teachers in India An Article publish in Newspaper">
                <button type="submit" style="padding:10px 20px;font-size:16px;">Get Report</button>
            </form>
            </body></html>
        `);
    }
    const r = await getClassification(title);
    res.send(`
        <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family:Arial;padding:15px;background:#f4f4f4;">
        <h2>Dual Classifier Report</h2>
        <p><b>Title:</b> ${title}</p>

        <div style="background:#e8f0ff;padding:15px;border-radius:10px;margin-bottom:15px;">
            <h3>UDC 1961 (Abridged Edition)</h3>
            <p style="font-size:22px;color:green;"><b>${r.udc}</b></p>
            <p><b>Main Subject:</b> ${r.mainSubject || '-'}</p>
            <p><b>Sub Subject:</b> ${r.subSubject || '-'}</p>
            <p><b>UDC Breakdown:</b> ${r.udcBreakdown || '-'}</p>
            <p><b>Newspaper/Article:</b> ${r.newspaperArticle ? 'Yes' : 'No'}</p>
            <p><b>Newspaper Number (UDC):</b> ${r.newspaperNumberUDC || 'N/A'}</p>
        </div>

        <div style="background:#e8ffe8;padding:15px;border-radius:10px;margin-bottom:15px;">
            <h3>DDC 23 (Dewey Decimal Classification)</h3>
            <p style="font-size:22px;color:blue;"><b>${r.ddc}</b></p>
            <p><b>DDC Breakdown:</b> ${r.ddcBreakdown || '-'}</p>
            <p><b>Newspaper Number (DDC):</b> ${r.newspaperNumberDDC || 'N/A'}</p>
        </div>

        <div style="background:#fff8e8;padding:15px;border-radius:10px;">
            <p><b>Confidence:</b> ${r.confidence || '-'}</p>
            <p><b>Audit (UDC + DDC):</b> ${r.audit || '-'}</p>
        </div>

        <br><a href="/udc">Try another title</a>
        </body></html>
    `);
});

// --- POST routes for API use ---
app.post('/get-udc', async (req, res) => {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    const r = await getClassification(title);
    res.json({ title, ...r });
});

app.post('/get-udc-bulk', async (req, res) => {
    const { titles } = req.body;
    if (!titles || !Array.isArray(titles)) return res.status(400).json({ error: "titles array required" });
    const results = [];
    for (let title of titles) {
        const r = await getClassification(title);
        results.push({ title, ...r });
        await new Promise(r => setTimeout(r, 500));
    }
    res.json(results);
});

app.get('/', (req, res) => {
    res.send('Dual Classifier App is running! Go to <a href="/udc">/udc</a> for report.');
});

app.listen(port, () => {
    console.log(`Server running at port ${port}`);
});
