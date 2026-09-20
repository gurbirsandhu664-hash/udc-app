# UDC One-Click V36 — Stable

This is a clean replacement for the `Cannot GET /` problem.

## Files
- `index.html` — web UI
- `server.js` — Express server + Gemini final classifier + optional Groq research
- `package.json` — Render start configuration
- `seed-udc.json` — small starter reference set
- `.env.example` — environment variables

## Render
Create a Web Service from this folder/repository.

Build Command:
`npm install`

Start Command:
`npm start`

Environment variables:
- `GEMINI_API_KEY` = your Google AI Studio/Gemini API key
- `GEMINI_MODEL` = `gemini-3.8-flash` (or another model available to your key)
- `GROQ_API_KEY` = your Groq key (optional)
- `GROQ_MODEL` = `groq/compound` (optional)
- `PORT` is normally supplied by Render; the server defaults to 10000.

Important:
- Put real API keys in Render Environment Variables, not in GitHub.
- Groq is never used as the final answer in this version.
- Gemini uses Google Search grounding for web evidence.
- If Gemini cannot verify a defensible UDC number, the app does not invent one.
- This does not contain or reproduce the proprietary MRF/UDC database. A licensed UDC Abridged data file can be integrated separately.

## Local test
`npm install`
`npm start`
Then open `http://localhost:10000/`.
