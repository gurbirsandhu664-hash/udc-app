# UDC One-Click V45 ULTRA V6

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
