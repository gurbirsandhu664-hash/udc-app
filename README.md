# UDC Ultimate V24 — Gemini Primary + Google Grounding + Groq Fallback

This build is designed for the requested failure-safe flow:

1. **Local UDC key first** — `udc-2700-key.json` is included and is used without API quota.
2. **Gemini primary** — Gemini uses Google's built-in Search grounding for web evidence.
3. **Gemini key rotation** — `GEMINI_API_KEYS` can contain comma-separated keys; each is tried if needed.
4. **Groq fallback** — if Gemini is unavailable, rate-limited, returns no verified classification, or has no grounding evidence, Groq Compound uses web search.
5. **No fake fallback** — the app never turns an unresolved title into UDC `0`, `-`, or another guessed number.
6. **Clean UI** — provider errors/quota messages are not exposed as the classification answer. The user sees a clear `VERIFICATION REQUIRED` state instead.
7. **Evidence links** — verified AI results show the web sources returned by the provider.

## Render

Build command:
`npm install`

Start command:
`npm start`

Environment variables:
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- Optional `GEMINI_API_KEYS` and `GROQ_API_KEYS` for rotation.

Do not put API keys in `index.html` or commit `.env`.

## Important UDC note

The local JSON is a supplied/local answer key, not a substitute for the licensed complete UDC schedule. AI results are accepted only when web grounding evidence is returned. UDC Consortium documentation describes UDC as hierarchical and analytico-synthetic, with common auxiliaries and relation signs such as `+`, `/`, `:`, `::`, language, form, place and time auxiliaries.


## V24.2 behavior
- Gemini owns every AI final answer.
- Groq is research-only and its classification is never displayed as final.
- Gemini tries configured models and all configured keys.
- Google Search grounding is used for Gemini primary verification.
- If Gemini needs Groq web research, the research packet is passed back to Gemini for final adjudication.
- No 0/placeholder UDC is emitted.
- A few core exact anchors (including Education = 37) are available locally when present in the app key.
