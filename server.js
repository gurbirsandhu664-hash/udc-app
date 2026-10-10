const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "YOUR_API_KEY_HERE";

// --- Embedded UDC 1961 Abridged Edition Rules ---
const UDC_RULES = `
UDC 1961 ABRIDGED EDITION - KEY RULES:
- 028 = Reading and advice for readers
- 028.9 = Reading interests and habits
- 02 = Library and information science
- 37 = Education
- 05 = Serial publications / newspapers / journalism
- 316 = Sociology
- 659 = Advertising / public relations
- 681.3 = Data processing / computer science
- -055.2 = Women (auxiliary) — NOT authorized in 1961 abridged edition
- (540) = India (auxiliary) — NOT authorized in 1961 abridged edition
- Always give the shortest correct UDC number from the 1961 abridged edition.
- If a specific auxiliary is not in the 1961 edition, DO NOT add it.
`;

async function getUDCFromAI(title) {
    const systemPrompt = `You are an expert librarian specialized in UDC (Universal Decimal Classification) 1961 abridged edition.
Your ONLY job is to provide the EXACT UDC notation for the given title.

${UDC_RULES}

STRICT RULES:
1. NEVER make up your own notation. Use ONLY the rules given above.
2. Do NOT add auxiliaries like -055.2 or (540) unless the 1961 abridged edition authorizes them.
3. Preserve every letter, digit, decimal point, bracket, quote and suffix exactly.
4. Output ONLY valid JSON in this exact format: {"udc": "number", "reason": "short explanation in English"}`;

    const userPrompt = `Find the exact UDC 1961 Abridged Edition notation for this title: "${title}"`;

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

// --- Send one title ---
app.post('/get-udc', async (req, res) => {
    const { title } = req.body;
    if (!title) {
        return res.status(400).json({ error: "Title is required" });
    }
    const result = await getUDCFromAI(title);
    res.json({ title, udc: result.udc, reason: result.reason });
});

// --- Send many titles ---
app.post('/get-udc-bulk', async (req, res) => {
    const { titles } = req.body;
    if (!titles || !Array.isArray(titles)) {
        return res.status(400).json({ error: "titles array is required" });
    }
    const results = [];
    for (let title of titles) {
        const result = await getUDCFromAI(title);
        results.push({ title, udc: result.udc, reason: result.reason });
        await new Promise(r => setTimeout(r, 500));
    }
    res.json(results);
});

app.get('/', (req, res) => {
    res.send('UDC App is running!');
});

app.listen(port, () => {
    console.log(`Server running at port ${port}`);
});
