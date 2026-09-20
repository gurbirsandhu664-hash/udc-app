# UDC One-Click V44 ULTRA

- UDC-only classifier; never DDC.
- Deterministic high-value rules run before AI to prevent recurring semantic drift.
- UDC Summary-first design with notation audit and explicit evidence levels.
- Gemini + Google Search grounding when configured.
- Groq fallback when configured.
- Offline semantic fallback when providers fail or hit quota.
- Special protection against false `004` Computer classifications.
- Handles subject, process, relation, literary form, place patterns and selected UDC symbols.
- Does not bundle the licensed UDC MRF.

## Authority
The public UDC Summary is maintained by the UDC Consortium and is a selection of about 2,600 classes from the wider scheme. Follow the UDC Summary licence/attribution terms when using it.

## Render
Set `GEMINI_API_KEY` and optionally `GROQ_API_KEY`. Start with `npm start`.
