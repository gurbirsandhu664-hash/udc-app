# UDC One-Click V38

## Render
Build command:
`npm install`

Start command:
`npm start`

Environment variables:
- `GEMINI_API_KEY` = Google AI Studio/Gemini API key
- `GROQ_API_KEY` = Groq key (optional research support)
- `GEMINI_MODEL` = optional override

## What V38 changes
- White professional UI
- `/` route fixed
- Gemini Interactions API as primary path
- Google Search grounding on primary attempts
- Automatic Gemini model fallback
- Automatic no-search fallback
- Legacy Generate Content compatibility fallback
- Groq is research support, not the final classifier
- Structured JSON response
- No local 2700-title key and no copied licensed MRF/UDC database

Important: web grounding improves evidence, but it cannot guarantee an official UDC Abridged match for every title without licensed UDC reference data.
