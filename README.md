# UDC One-Click V48 ULTRA — Gemini Search

This is the advanced, seed-free successor to the supplied V45 ULTRA project.

## What changed

- No `seed-udc.json`.
- Gemini 3.8 Flash is the default stable model, with model fallbacks.
- Google Search grounding is enabled server-side.
- Candidate-generation + notation-audit workflow.
- UDC-only guard; DDC is explicitly prohibited.
- Deterministic high-value UDC rules for repeatability.
- Groq fallback remains optional.
- `/api/health` shows provider configuration.
- API keys stay server-side.
- Mobile-first premium interface.
- History and practice are client-side.
- Exact MRF-level claims are not fabricated when evidence is missing.

Google's Gemini documentation currently lists Gemini 3.8 Flash as a stable model and documents Google Search grounding for current Gemini models. The UDC Consortium/UDC Summary should be treated as the UDC reference layer; this project does not reproduce the licensed MRF.

## Render

Build Command:
`npm install`

Start Command:
`npm start`

Required Render Environment Variable:
`GEMINI_API_KEY=...`

Optional:
`GEMINI_MODEL=gemini-3.8-flash`
`GEMINI_FALLBACK_MODEL=gemini-3.7-flash`
`GROQ_API_KEY=...`
`GROQ_MODEL=openai/gpt-oss-120b`

## Files

- `index.html`
- `server.js`
- `package.json`
- `.env.example`
- `README.md`
- `VERSION.txt`

No seed JSON is included.

## Important

Search grounding improves evidence and freshness but does not turn a search result into an official UDC MRF record automatically. For authoritative production cataloguing, use authorized/licensed UDC data and verify the exact schedule entry.
