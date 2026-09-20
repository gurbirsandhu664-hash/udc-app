# UDC Master Search V36

Evidence-first UDC title classifier.

### Final-answer flow
1. Search supplied UDC reference records for useful matches.
2. Optionally collect research notes with Groq (research only).
3. Send the title, evidence and research context to Gemini.
4. Gemini uses Google Search grounding to retrieve web evidence and produce the **only final AI classification**.
5. If a defensible UDC notation cannot be verified, the UI returns a clear verification status instead of inventing a number or using `0`.

### V36 changes
- Real V36 package/version metadata and UI.
- Gemini is always the final AI provider; Groq cannot become the final answer.
- Gemini model/key fallback loop (`GEMINI_MODELS`, optionally `GEMINI_API_KEYS`) for legitimate configured keys/projects.
- Stronger UDC-vs-DDC instructions and auxiliary/notation checks.
- Better mobile UI and evidence/search-query display.
- More explicit quota/key/unverified handling.

### Environment
- `GEMINI_API_KEY` required, or `GEMINI_API_KEYS` for a comma-separated set of legitimately configured Gemini API keys.
- `GEMINI_MODELS` optional, comma-separated model names; default: `gemini-2.5-pro,gemini-2.5-flash,gemini-2.0-flash`.
- `GROQ_API_KEY` optional research-only.
- `GROQ_MODEL` optional.
- `PORT` optional; Render supplies it.

### UDC data
The bundled data is only starter/reference data. A complete licensed UDC MRF/Abridged dataset should only be imported if you have the right to use it. Google Search grounding can retrieve evidence but does not magically create a licensed 70,000-class database.

### Run
`npm install`

`npm start`
