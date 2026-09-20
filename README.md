# UDC TITAN v50

## What changed
- Gemini 3.8 Flash is the first Google route.
- Gemini 3.1 Pro is the second Google reasoning route.
- Google Search grounding is enabled on Gemini routes.
- Groq Compound, GPT-OSS 120B and Qwen 3.8 are fallback routes.
- Optional OpenAI GPT-5.6 Sol and Anthropic Claude Opus 5 routes.
- Adaptive AI jury stops after enough successful independent routes.
- Retries transient 429/5xx errors.
- Provider failures are silently skipped; the UI does not expose raw quota errors.
- Disagreement is surfaced as REQUIRES VERIFICATION instead of inventing a classmark.
- UDC-only system prompt and cross-scheme contamination checks.
- No copied UDC seed/reference database is shipped.
- Browser never receives API keys.

## Render
Build command:
npm install

Start command:
npm start

Set at least:
GEMINI_API_KEY=...

For meaningful failover also set:
GROQ_API_KEY=...

Optional:
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...

## Replace
Replace:
index.html
server.js
package.json

You can also keep ENV.example and README.md.

Delete old local classifier/reference files such as:
seed-udc.json
udc-reference.json
old duplicate HTML/JS classifier files

## Important accuracy note
No software can honestly guarantee that every title will have a correct UDC classmark when the authoritative licensed UDC schedule is unavailable. This build is designed to prefer verification and to refuse a fabricated number when the AI jury lacks sufficient corroboration.

Google's current Gemini documentation lists Gemini 3.8 Flash as a stable model and Gemini 3.1 Pro as a preview model, and documents Google Search grounding for both. Groq's current model documentation lists Compound, GPT-OSS 120B and Qwen 3.8 among its supported systems/models.
