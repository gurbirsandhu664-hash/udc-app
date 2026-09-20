# UDC One-Click V35 — Evidence Search Engine

A one-click UDC title classifier designed around evidence retrieval rather than guessing.

## Search flow
1. Exact verified local UDC record check.
2. Optional Groq research notes (never final).
3. Gemini final classifier with Google Search grounding.
4. Gemini may automatically issue multiple Google queries and synthesize the evidence.
5. UI shows the actual grounding search queries and clickable source pages returned by Google grounding.
6. If a defensible UDC number cannot be verified, the app returns `NO VERIFIED UDC RESULT` instead of inventing a number.

Google documents that Gemini's Google Search grounding can automatically generate one or multiple search queries, process results, and return citations. Current Gemini models including Gemini 3.8 Flash, Gemini 3.1 Pro Preview, Gemini 2.5 Pro and Gemini 2.5 Flash support Google Search grounding.

## UDC policy
- UDC only, never DDC.
- Prefer authoritative UDC Consortium evidence when available.
- Apply auxiliaries only when justified by the title/evidence.
- Do not fabricate a 70,000-class database. The bundled seed data is only starter reference data.
- Import only a UDC dataset you are legally entitled to use. UDC Consortium states that use of UDC MRF data requires a licence; UDC Summary's 2,600 classes have separate licensing terms.

## Render
Build: `npm install`
Start: `npm start`

Environment:
- `GEMINI_API_KEY` required for AI search/classification
- `GEMINI_MODELS` optional comma-separated Gemini model fallback list
- `GROQ_API_KEY` optional research-only
- `GROQ_MODEL` optional
- `PORT` optional (Render supplies its own port)

## Important
Google Search grounding is a search/retrieval aid, not proof that every returned UDC number is correct. The classifier therefore requires the evidence to support the final result and otherwise reports that verification is required.
