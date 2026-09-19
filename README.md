# UDC Ultimate V18.1.1 — Gemini + Google Grounding + Groq — FIXED

This version is designed around the requested behavior:

**Title → local UDC key → Gemini + Google Search grounding → Groq fallback → verified result shown inside the app.**

It does **not** turn a Google search result into a clickable-only answer.

## Important behavior

- Local `udc-2700-key.json` is checked first.
- If the title is not in the local key, Gemini is called with Google Search grounding.
- If Gemini is rate-limited/quota-exhausted, another Gemini key is tried, then Groq.
- Groq can use `groq/compound` for built-in web search.
- A provider failure never becomes UDC number `0`.
- If no trustworthy UDC classification is obtained, the UI shows:
  `NOT VERIFIED — No reliable UDC classification found.`
- The app never invents a UDC number merely to fill the card.
- Google-grounded evidence and source URLs are displayed inside the result card when returned by Gemini.
- API keys stay server-side in environment variables.

## Render

Build command:
`npm install`

Start command:
`npm start`

Add your keys in Render Environment Variables:

`GEMINI_API_KEYS=key1,key2`
`GROQ_API_KEYS=key1,key2`

Or the single-key variables:
`GEMINI_API_KEY`
`GROQ_API_KEY`

Do not upload real keys to GitHub.

## Your existing 2700-title key

Put your existing file beside `server.js`:

`udc-2700-key.json`

The loader accepts either:
- an array of records
- `{ "records": [...] }`
- `{ "entries": [...] }`
- a simple object map

Existing records are normalized without requiring a fixed schema.

## Result policy

A local key hit is marked `LOCAL KEY VERIFIED`.

A web/AI result is marked `GOOGLE-GROUNDED` only when Gemini returns Google grounding metadata.

A Groq web-search result is marked `GROQ WEB SEARCH`; it is not falsely labeled Google-grounded.

If the AI cannot provide a defensible UDC number, the app shows status only.

## Sources

Gemini Google Search grounding is implemented using the Gemini API's built-in Google Search tool.

Groq fallback uses the official Groq SDK and `groq/compound` when configured.
