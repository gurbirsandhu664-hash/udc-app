# UDC One-Click V39 — Live Evidence Search Engine

## What changed
- Gemini is the FINAL classifier.
- Gemini can use Google Search grounding for live web evidence.
- Groq is optional and research-only; its output is passed to Gemini and is never shown as the final UDC answer.
- No 2,700-title local key and no fake 70,000-class database.
- Random/complex titles are processed instead of requiring a local title match.
- Multiple Gemini models can be attempted automatically.
- The UI shows evidence, sources, confidence, and whether the result was grounded.
- The server keeps API keys off the browser.

## Setup
1. Install Node.js 18+.
2. Copy `.env.example` to `.env`.
3. Put your Google AI Studio/Gemini key in `GEMINI_API_KEY`.
4. Optionally put your Groq key in `GROQ_API_KEY`.
5. Run:
   npm install
   npm start
6. Open http://localhost:10000

## Render
Build Command: `npm install`
Start Command: `npm start`
Add the environment variables in Render → Environment.

Important:
This app is designed to search and reason over publicly available evidence. It does not contain or reproduce a proprietary UDC Master Reference File. For exact Abridged Edition authority, use an authorized/licensed UDC reference when available.
