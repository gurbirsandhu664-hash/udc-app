// VERSION 27 - SERVER CONTROLLED - CLEAN ENGLISH CODE
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const CONFIG = {
    version: "27",
    versionBadge: "VERSION 27 - SERVER WALA - UDC AI",
    appTitle: "UDC AI V27",
    systemPrompt: "You are UDC Version 27 expert. Give correct short answers for UDC exam.",
    geminiModel: "gemini-1.5-flash"
};

const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.geminiModel}:generateContent?key=`;

app.get('/api/config', (req, res) => res.json(CONFIG));
app.get('/', (req, res) => res.send(`UDC V${CONFIG.version} Running`));

app.post('/api/ask', async (req, res) => {
    try {
        const { question } = req.body;
        if (!question) return res.status(400).json({ error: "Question required" });
        const finalPrompt = `${CONFIG.systemPrompt}\nQuestion: ${question}`;
        const response = await fetch(GEMINI_URL + GEMINI_API_KEY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: finalPrompt }] }] })
        });
        const data = await response.json();
        const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "No answer";
        res.json({ answer, version: CONFIG.version });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(process.env.PORT || 3000, () => console.log("V27 Running"));
