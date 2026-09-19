# UDC Ultimate V21 — Google + Gemini + Groq

UDC-only classifier. Local title keys are checked first. Unknown titles use Gemini with Google Search grounding, then optional Google Custom Search + Groq, then Groq.

## Environment variables
- `GEMINI_API_KEY` (and `_2` … `_10`)
- `GROQ_API_KEY` (and `_2` … `_10`)
- Optional Google Custom Search fallback: `GOOGLE_API_KEY` and `GOOGLE_CX`
- Optional models: `GEMINI_MODEL`, `GROQ_MODEL`

## Important behavior
- Never displays `0` as a fabricated classification.
- A provider quota/429 is handled server-side and does not expose the raw provider error to the user.
- Gemini uses Google Search grounding when available.
- Google Search evidence is shown inside the app when returned.
- A specific UDC number is only displayed when a local key/provider returns a defensible number.

## Render
Start command: `npm start`
Node: 18+
