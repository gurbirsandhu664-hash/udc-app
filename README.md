# UDC/DDC Classifier — V130 (accountless fallback mode)

## Classification flow
- The app searches its bundled UDC B.S. 1000A:1961 reference index and DDC-23 Volumes 1–4 reference index.
- Provider: **Gemini primary only**. Bundled UDC 1961 and DDC-23 schedules remain the classification authorities. Wikipedia and Groq have been removed from this build. DeepSeek was already removed.
- Deterministic title rules and the bundled UDC/DDC reference corpora remain in place.

## API keys
Set `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) as a server-side environment variable for the primary AI provider. **Do not set or use `GROQ_API_KEY` or `DEEPSEEK_API_KEY`; this version does not call Groq or DeepSeek.** Never place API keys in `index.html` or commit them into the ZIP.

## Run
- Node.js 20+ recommended
- `npm install`
- `npm start`
- Default port: `10000` (or `PORT`)
- `GET /api/health` reports provider configuration, bundled reference counts, and Gemini configuration.

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


## V129 professional authority provider registry
The interface now lists the four services requested for stronger authority-backed classification:
- **DDC:** OCLC WebDewey and OCLC WorldShare AI
- **UDC:** UDC Online (with the public UDC Summary link shown separately)
- **AI-assisted subject indexing:** Annif

The provider panel obtains readiness information from `/api/health`. It intentionally labels these services **not connected** unless the app has a configured endpoint where supported. This release does **not** claim to query OCLC/UDC Online or Annif, and does not silently substitute them for the current Gemini + bundled-reference workflow. OCLC and UDC Online require the relevant licensed access and approved API arrangements; provider-specific adapters must be implemented against the API contract available to your account before classification can call them. `ANNIF_API_URL` currently affects only the displayed endpoint-readiness indicator; it does not activate Annif classification. Keep all credentials server-side and never paste secrets into `index.html` or the ZIP.

## Validation scope
V129 adds a provider registry/status panel and health metadata while preserving the V127 classification core and bundled UDC/DDC indexes. The project should be deployed and tested on Render after upload; live provider connectivity and classification accuracy are not claimed by the UI-only registry.


## V129 — real Annif adapter and provider configuration
- Added `POST /api/providers/annif/suggest` which calls the configured Annif `/v1/projects/{project_id}/suggest` endpoint and returns suggestions without treating them as verified UDC/DDC numbers.
- Configure `ANNIF_API_URL`, `ANNIF_PROJECT_ID`, and optional `ANNIF_API_TOKEN` as Render environment variables.
- Added `.env.example` documenting server-side variables for Gemini and licensed providers. Never commit real secrets.
- OCLC WebDewey, WorldShare AI, and UDC Online are only marked configured when both endpoint and credentials are present; their account-specific API contracts are still required before classification can call them. No false claim of live connectivity is made.


## V130 — run without paid accounts
- No OCLC, UDC Online, or Annif account is required to launch the app. The bundled UDC 1961 and DDC-23 indexes and deterministic local rules remain available.
- Gemini is optional: without `GEMINI_API_KEY`, the app falls back to local rules/reference evidence. This can produce broader or unverified answers; it does not provide the same capability as a licensed authoritative lookup.
- The professional-provider panel explicitly labels OCLC/UDC Online/Annif as disconnected until real account-approved endpoints and credentials are configured.
- `GET /api/health` includes `accountlessMode: true` and an explanatory note.
- This release does not claim live deployment or live provider access. Run `npm install` then `npm start`; deploy to Render only after checking the project and preserving the existing deployment backup.
