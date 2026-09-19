# UDC Ultimate V26 — Direct Match + Gemini FINAL

## Purpose
A UDC-only book-title classifier. It checks the supplied 2701-title key first, then uses Gemini as the only AI final-answer engine. Groq is optional research support only.

## Final-answer order
1. Exact normalized direct match in the 2701-title key.
2. Very-close local key match only when the match is highly unambiguous.
3. Gemini FINAL with Google Search grounding.
4. If Gemini primary attempts are unavailable, optional Groq research is collected and sent back to Gemini. Groq is never displayed as the final classification.
5. If no final can be produced, the app clearly says NOT VERIFIED and never substitutes 0.

## Environment variables
- `GEMINI_API_KEY` — one Gemini key
- `GEMINI_API_KEYS` — optional comma-separated Gemini keys; all are tried
- `GEMINI_MODELS` — optional comma-separated models
- `GROQ_API_KEY` — optional Groq research key
- `GROQ_API_KEYS` — optional comma-separated Groq keys
- `GROQ_MODEL` — optional Groq model
- `PORT` — supplied by Render automatically

## Important data note
`udc-2700-key.json` is the project's supplied direct-match dataset. It should not be described as a complete official UDC MRF. For an authoritative UDC Summary dataset, use data supplied under the applicable UDC Consortium licence/terms.
