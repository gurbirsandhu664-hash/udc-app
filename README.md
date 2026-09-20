# UDC One-Click V45 ULTRA

Evidence-first UDC classifier. UDC ONLY; never DDC.

## V45 improvements
- Current Gemini model order starts with Gemini 3.8 Flash and supports Google Search grounding.
- Deterministic UDC safeguards run before AI.
- Agriculture crop/process notation is explicitly audited.
- Known evidence-backed examples include wheat `633.11`, maize `633.15`, barley `633.16`, harvesting `631.55`.
- `Harvesting of Wheat and Maize` is handled as `633.11+633.15:631.55` (wheat 633.11, maize 633.15, harvesting 631.55).
- `Harvesting of Wheat and Barley` is handled as `633.11+633.16:631.55`.
- AI/provider failure no longer produces “classification paths exhausted”; the local semantic safety net returns a result with an evidence status.
- 004 is blocked unless the title is genuinely about computing.
- No licensed UDC MRF is bundled.

## Render
Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL`, `GEMINI_PRO_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL` as environment variables.
Start with `npm start`.
