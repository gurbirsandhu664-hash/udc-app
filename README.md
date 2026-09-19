# UDC Ultimate V19 — Gemini + Google

This version uses ONLY:
1. Your local UDC practice key (`udc-2700-key.json`, if present)
2. Gemini with Google Search grounding for titles not found locally.

No Groq dependency.

## Render
Start Command: `node server.js`

Keep your existing Render Environment Variable:
`GEMINI_API_KEY`

Optional:
`GEMINI_MODEL=gemini-2.5-flash`

Do not put the real API key in GitHub or the ZIP.

## Important
Google Search grounding can research web sources, but Google is not an official UDC database. The app therefore asks Gemini to prefer authoritative UDC/library sources and to return Review required if reliable evidence is insufficient.

Put your real `udc-2700-key.json` in the project root. Do not replace it with an empty/sample key.
