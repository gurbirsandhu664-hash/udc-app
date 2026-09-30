# UDC AI Classifier V32 — 1961 Edition Locked

A Node/Express web app for classifying English book titles using the supplied **B.S. 1000A:1961 Universal Decimal Classification, Abridged English Edition, 3rd Edition Revised 1961** reference.

## Core behavior
- UDC only — never DDC.
- 1961-edition locked: the AI prompt explicitly forbids silently replacing 1961 notation with modern UDC/MRF notation.
- Deterministic answer keys run before AI.
- Safer fuzzy matching handles harmless title wording such as `A History of India` without turning unrelated titles into fixed answers.
- Unknown/random English titles do not produce a classification-service error. The app falls back to a broad 1961 UDC class and marks it **PROVISIONAL** when an exact source-backed number cannot be established.
- Optional book description/contents can be supplied for difficult titles.
- The app never claims a provisional number is verified.

## Render
Build: `npm install`
Start: `npm start`
Environment variable: `GEMINI_API_KEY`
Optional: `GEMINI_MODEL`
