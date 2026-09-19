# UDC Search Engine V30 STABLE

A production-oriented UDC title classifier/search engine.

## Final-answer architecture
- **Gemini is the ONLY final classifier.**
- **Groq is research-only** and is never displayed as the final classification.
- Gemini uses **Google Search grounding** to find current web evidence.
- Optional Google Programmable Search evidence can be added with `GOOGLE_CSE_KEY` + `GOOGLE_CSE_ID`.
- Gemini keys and models rotate automatically after quota/rate-limit/model/network failures.
- No 2700-title local key is bundled.
- No DDC, no `0`, no random placeholder number.
- If Gemini cannot verify a defensible classification, the UI shows a clean verification status.

## Render
Build command:
`npm install`

Start command:
`npm start`

## Environment variables
Required:
`GEMINI_KEYS=key1,key2`

Optional aliases:
`GEMINI_KEY=...`
`GOOGLE_AI_STUDIO_KEY=...`

Recommended model rotation for this release:
`GEMINI_MODELS=gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite`

Research only:
`GROQ_KEYS=key1,key2`
`GROQ_MODEL=groq/compound`

Optional separate Google Programmable Search:
`GOOGLE_CSE_KEY=...`
`GOOGLE_CSE_ID=...`

## Important UDC data note
UDC Summary is an official abridged selection of about 2,600 classes. The complete UDC scheme contains 70,000+ entries. A public app should not claim that an AI can guarantee an exact classification for every arbitrary title without authoritative schedule evidence or a licensed/current full dataset.

The classifier therefore uses evidence + hierarchy + permitted UDC synthesis and refuses to fabricate a number when verification fails.
