# UDC One-Click V45 ULTRA V9

V45 is preserved. The bundled uploaded UDC source is the primary classification authority:

**Universal Decimal Classification — B.S. 1000A:1961, Abridged English Edition, 3rd Edition Revised 1961.**

## Classification behavior

- Uploaded UDC 1961 is the controlling source.
- No DDC substitution.
- No silent modernization to current UDC.
- Complete-title semantic analysis is required.
- The evidence engine searches the full uploaded UDC text, ranks relevant pages using title terms/synonyms/rare-term weighting, and includes adjacent pages for table continuations.
- The AI classifier receives the retrieved evidence and must verify main-table notation plus every auxiliary before returning a final number.
- Exact source-verified safeguards are used only for entries already checked against the uploaded edition; they are not the general classification mechanism.
- If no AI provider is configured, the app will retrieve and display evidence but will **not invent** a final number.

## Render configuration for arbitrary titles

For automatic classification of titles that are not one of the deterministic safeguards, configure at least one provider in Render environment variables:

- `GEMINI_API_KEY` — recommended
- `GEMINI_MODEL` — optional; defaults to `gemini-2.5-flash`
- `GROQ_API_KEY` — optional fallback
- `GROQ_MODEL` — optional

Do **not** put real API keys into GitHub files. Add them as Render environment variables.

## Start

```bash
npm start
```


## V9 ALL-TITLE ENGINE
- V45 remains preserved.
- The bundled B.S.1000A:1961 uploaded UDC remains the controlling source.
- Added generic semantic facet construction for library types, place auxiliaries, and document forms.
- This is not an individual-title hard-code; the engine combines source-verified components when the title contains the corresponding facets.
- No DDC substitution and no silent modernization to current UDC.
