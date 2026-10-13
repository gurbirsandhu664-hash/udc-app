# UDC/DDC Classifier — V127 with Wikipedia subject context

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


V125 adds deterministic exact-title recovery for “idioms and expression in Punjabi language”. DDC is marked unverified rather than guessed when the exact DDC-23 number has not been established.


V127 notes: async classify route now uses Express 4-compatible rejection forwarding; astronomical organisation directory titles get broad UDC 52 / DDC 520 with explicit notice that the detailed form notation remains unverified.


## V127 accuracy boost
- Fixed regex bug /\\bfamous\\b/ that prevented famous Indian scientists rule from matching (now /\bfamous\b/)
- Replaced fake model names gemini-3.x-flash with real models gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-flash etc. and added multi-model retry loop for Gemini primary provider
- Expanded UDC concept fallback C array from ~30 to ~70 concepts covering librarianship, bibliography, classification, religion facets, agriculture crops, management, arts, languages
- Added concept-based fallback in localClassify: when no exact rule matches, builds UDC notation from keyword matches, supports India/Punjab place auxiliaries and + coordination for titles with 'and'
- Expanded DDC_ANSWER_KEY from ~30 to ~60+ titles including computer science, AI/ML, philosophy, psychology, religion, politics, economics, education, math, physics, chemistry, astronomy, biology, medicine, engineering, agriculture, management, architecture, music, sports, literature, Hindi/Punjabi languages, bibliography, history of India/Punjab
- Improved retrieveReferenceEvidence scoring with IDF-like weighting and increased limits (8 pages, 8000 chars) for better grounding
- Increased accuracy guard: 004 only when title explicitly mentions computing terms
- ENGINE_VERSION V127 accuracy-boosted
