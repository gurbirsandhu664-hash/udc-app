# UDC Classifier — V45 ULTRA Stable

UDC-only book-title classifier. Never DDC.

## Run

```bash
npm install
npm start
```

The deterministic client rules are available without an AI key. Optional
Gemini/Groq keys can be supplied for additional fallback classification, but
exact high-priority title rules run first.

## Release contents

- `index.html` — preserved UI with corrected deterministic classifier
- `server.js` — Render/Node server and API fallback
- `package.json` — start configuration
- `seed-udc.json` — curated public-reference seed entries
- `RELEASE_NOTES.txt` — V45 ULTRA stable release notes
- `.env.example` — optional AI environment variables

No `VERSION.txt` is included.
