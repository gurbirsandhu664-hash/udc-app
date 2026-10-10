const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "YOUR_API_KEY_HERE";

// --- Embedded UDC 1961 + DDC 23 Rules ---
const CLASSIFICATION_RULES = `
=== UDC 1961 ABRIDGED EDITION (KEY RULES) ===
- 028 = Reading and advice for readers
- 028.9 = Reading interests and habits
- 02 = Library and information science
- 05 = Serial publications / Newspapers / Journalism / Periodicals
- 37 = Education
- 378 = Higher education / Universities
- 316 = Sociology
- 659 = Advertising / public relations
- 681.3 = Data processing / computer science
- -055.2 = Women (auxiliary) — authorized in 1961 abridged edition
- (540) = India (common auxiliary of place) — authorized in 1961 abridged edition
- Colon (:) = Relation indicator linking two subjects
- Always give the SHORTEST correct UDC number from the 1961 abridged edition.
- If a title mentions newspaper, article, journal, magazine, serial or periodical, you MUST add 05 as an additional facet using the colon.

=== DDC 23 (DEWEY DECIMAL CLASSIFICATION 23rd EDITION - KEY RULES) ===
- 028 = Reading and use of other information media
- 028.9 = Reading interests and habits
- 070 = News media / Newspapers / Journalism
- 371 = Schools and their activities
- 378 = Higher education
- 305 = Social groups (including women)
- 954 = India / South Asia
- Standard subdivisions: -09, -093, -091, etc. are allowed
- Always give the SHORTEST correct DDC 23 number.
- If a title mentions newspaper, article, journal, magazine, serial or periodical, use 070 for news media.

=== DUAL CLASSIFIER OUTPUT RULES ===
- Provide BOTH UDC 1961 and DDC 23 numbers for every title.
- For UDC: use colon to link main subject with newspaper/article code 05 if applicable.
- For DDC: use 070 for newspaper articles if applicable.
- Never guess. Never add unauthorized auxiliaries.
- Output must be complete, no truncation.
`;

async function getClassification(title) {
    const systemPrompt = `You are an expert librarian specialized in UDC (Universal Decimal Classification) 1961 abridged edition AND DDC 23 (Dewey Decimal Classification 23rd edition).
Your job is to provide BOTH UDC and DDC numbers in a detailed Dual Classifier report.

${CLASSIFICATION_RULES}

STRICT OUTPUT FORMAT (JSON only, no extra text):
{
  "udc": "full UDC 1961 number",
  "ddc": "full DDC 23 number",
  "mainSubject": "short main subject",
  "subSubject": "sub subject / context",
  "udcBreakdown": "detailed UDC notation breakdown and rules used",
  "ddcBreakdown": "detailed DDC 23 breakdown and rules used",
  "confidence": "high / medium / low",
  "audit": "notation audit notes for both UDC and DDC",
  "newspaperArticle": true or false,
  "newspaperNumberUDC": "UDC 05 code if applicable, otherwise N/A",
  "newspaperNumberDDC": "DDC 070 code if applicable, otherwise N/A"
}`;

    const userPrompt = `Find BOTH the exact UDC 1961 Abridged Edition notation AND DDC 23 notation with FULL DETAILS for this title: "${title}".
If this title is a newspaper article or published in a newspaper/journal, include the UDC 05 code and the DDC 070 code.
Output must be complete JSON as per the format.`;

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
            udc: "ERROR",
            ddc: "ERROR",
            mainSubject: "-",
            subSubject: "-",
            udcBreakdown: "API call failed",
            ddcBreakdown: "API call failed",
            confidence: "low",
            audit: "API call failed",
            newspaperArticle: false,
            newspaperNumberUDC: "N/A",
            newspaperNumberDDC: "N/A"
        };
    }
}

// --- GET route (Browser-friendly, full Dual Classifier report) ---
app.get('/udc', async (req, res) => {
    const title = req.query.title;
    if (!title) {
        return res.send(`
            <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
            <body style="font-family:Arial;padding:20px;background:#f4f4f4;">
            <h2>Dual Classifier Tester (UDC 1961 + DDC 23)</h2>
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

// --- POST routes (API use) ---
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
