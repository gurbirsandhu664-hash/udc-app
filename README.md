# UDC Ultimate V20 — Gemini + Groq Stable

UDC-only classifier. It does not use DDC.

## Provider order
1. Existing local UDC title key (`udc-2700-key.json` or `udc-2600-key.json`) — exact/fuzzy protected answer first.
2. Gemini API — primary AI classification.
3. Groq API — automatic fallback when Gemini is unavailable, including quota/rate-limit failures.
4. Safe `Verification required` fallback if both providers fail.

The browser never receives raw Gemini/Groq quota errors as the classification result.

## Render Environment Variables
Required/recommended:
- `GEMINI_API_KEY`
- `GROQ_API_KEY`

Optional second keys (the server can rotate through them):
- `GEMINI_API_KEY_2`
- `GROQ_API_KEY_2`

Optional models:
- `GEMINI_MODEL=gemini-2.5-flash`
- `GROQ_MODEL=llama-3.3-70b-versatile`

Keep your existing `udc-2700-key.json` and/or `udc-2600-key.json` in the project folder. Keep `udc-rules.json` too if you use it.

## Important quota note
Two API keys do not automatically double Gemini quota when both keys belong to the same Google project; Google applies Gemini rate limits at the project level. This app therefore uses Gemini→Groq failover and retries rather than pretending quota can be removed in code.

## Deploy
Build command: `npm install`
Start command: `npm start`
