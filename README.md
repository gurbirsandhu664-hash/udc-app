# UDC One-Click V40 — White Stable / Quota-Resilient

This build fixes the recurring Gemini 429/404 failure pattern shown in the supplied screenshot. It does not bypass provider quotas; instead it uses a controlled fallback chain.

## Route order
1. Gemini + Google Search grounding across configured models
2. Same Gemini models without Search grounding if Search quota/tooling fails
3. Groq fallback when Gemini quota is exhausted
4. Local exact-match seed only as a last safety net

The final result is labelled with the engine/route used. No DDC and no copied proprietary MRF data are included.

## Render
Build: `npm install`
Start: `npm start`

Set `GEMINI_API_KEY`. Set `GROQ_API_KEY` for the fallback. You can override the model chains with `GEMINI_MODELS` and `GROQ_MODELS`.

Important: API quotas are controlled by Google/Groq and cannot be permanently bypassed by application code. This version prevents one exhausted model from killing the whole request.


V40 semantic guard: UDC 004 is rejected when the title does not actually indicate computing/computer science/IT/ICT/software/data processing. Generic “technology” wording alone cannot trigger 004.
