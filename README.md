# UDC One-Click V33

## What it does
- One-click title classification.
- Exact verified supplied-dataset match is used first.
- Otherwise Gemini is the ONLY AI allowed to produce the final UDC result.
- Gemini uses Google Search grounding when available.
- Multiple Gemini models can be tried in sequence.
- Groq is optional research-only support and is never displayed as the final classification.
- No guessed `0`, no fabricated UDC number.
- If a defensible result cannot be verified, the UI clearly says verification is required.
- Supports import of a legally obtained/licensed UDC dataset in JSON, CSV, or simple TXT format.

## Render
Build command: `npm install`
Start command: `npm start`

Set environment variables in Render:
- GEMINI_API_KEY = your Google AI Studio/Gemini API key
- GEMINI_MODELS = working Gemini model names, comma-separated
- GROQ_API_KEY = optional
- GROQ_MODEL = optional
- PORT = 10000

## Important
The bundled seed file is only a small starter reference set. It is NOT a 70,000-class official UDC file.
Do not copy or bypass a copyrighted/licensed UDC MRF. Import only a dataset you are legally entitled to use.

## Expected behavior
For a title such as "Education", a supplied verified direct match can return 37.
For an unknown/random title, the engine attempts Gemini + Google Search grounding. If evidence is insufficient, it returns a clean verification status rather than inventing a number.
