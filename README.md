# UDC/DDC Classifier — V101 with Wikipedia subject context

## Classification flow
- The app searches its bundled UDC B.S. 1000A:1961 reference index and DDC-23 Volumes 1–4 reference index.
- A server-side Wikipedia REST search adds short subject-context snippets when Wikipedia is reachable.
- Wikipedia is supplementary context only; it is not a UDC/DDC schedule and cannot verify class numbers.
- Provider order: **Gemini primary, Groq fallback**. Wikipedia supplies supplementary subject context. Bundled UDC 1961 and DDC-23 schedules remain the classification authorities. DeepSeek code and configuration have been removed from this build.
- Deterministic title rules and the bundled UDC/DDC reference corpora remain in place.

## API keys
Set `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) as a server-side environment variable for the primary AI provider. Set `GROQ_API_KEY` as an optional backup and optionally set `GROQ_MODEL`. **Do not set or use `DEEPSEEK_API_KEY`; this version does not call DeepSeek.** Never place API keys in `index.html` or commit them into the ZIP.

## Run
- Node.js 20+ recommended
- `npm install`
- `npm start`
- Default port: `10000` (or `PORT`)
- `GET /api/health` reports provider configuration, bundled reference counts, and Wikipedia-context capability.

## Required files
Keep `server.js`, `index.html`, `package.json`, `udc-1961-reference-index.json`, and `ddc-23-reference-index.json` in the same deployment directory.
