# UDC TITAN — Gemini Search Ultimate

This build removes the local UDC seed/reference dependency from the classifier.

## Render
Build:
`npm install`

Start:
`npm start`

Environment:
`GEMINI_API_KEY=...`

Optional:
`GEMINI_MODEL=gemini-3.1-pro-preview`

## Architecture
Browser -> /api/classify -> Gemini high-reasoning model + Google Search grounding -> JSON parsing -> UDC consistency audit -> browser.

The API key is server-side only.

## Important
Google Search grounding is used as evidence retrieval, not as a substitute for an authoritative licensed UDC schedule. The application must not claim that a web source supports a classmark unless the source actually supports it.

The complete UDC schedules are proprietary/licensed material. This package intentionally does not ship a copied 72,000-class UDC database.

## Replace
Use:
- index.html
- server.js
- package.json

Delete old:
- seed-udc.json
- udc-reference.json
- udc-reference.example.json
- old duplicate classifier HTML/JS files

Keep your Render environment variable `GEMINI_API_KEY`.
