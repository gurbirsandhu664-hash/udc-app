# UDC One-Click V37 — resilient Gemini classifier

### What changed
- Removed the fragile requirement that Gemini Search + JSON structured output succeed in one request.
- Tries Google Search grounding first, then automatically retries Gemini without Search.
- Tries multiple Gemini models if a model is unavailable to the API key.
- Groq remains research-only and can never become the final answer.
- Keeps `/` routing so Render does not show `Cannot GET /`.
- Never returns `0` as a guessed UDC number.
- Final result is clearly marked VERIFIED only when Google grounding evidence was actually returned; otherwise AI_CLASSIFICATION/UNVERIFIED is used.

### Render
Build: `npm install`
Start: `npm start`

Set `GEMINI_API_KEY` in Render Environment Variables.
Optional: `GROQ_API_KEY`.

Do not put API keys in GitHub.

A truly exhaustive, authoritative UDC Abridged classifier still requires licensed UDC reference data. Web grounding + Gemini improves coverage but cannot guarantee a correct classification for every possible title.
