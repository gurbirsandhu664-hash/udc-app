# UDC One-Click V45 ULTRA

Evidence-first UDC classifier. UDC ONLY; never DDC.

## V45 improvements
- Current Gemini model order starts with Gemini 3.8 Flash and supports Google Search grounding.
- Deterministic UDC safeguards run before AI.
- Agriculture crop/process notation is explicitly audited.
- Known abridged examples use `633.1` for cereals/grain crops and `631.5` for agricultural operations.
- `Harvesting of Wheat and Maize` is handled as `633.1:631.5`; the public abridged Summary does not expose separate wheat/maize crop numbers in this selection.
- `Harvesting of Wheat and Barley` is handled as `633.1:631.5`.
- AI/provider failure no longer produces “classification paths exhausted”; the local semantic safety net returns a result with an evidence status.
- 004 is blocked unless the title is genuinely about computing.
- No licensed UDC MRF is bundled.

## Render
Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL`, `GEMINI_PRO_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL` as environment variables.
Start with `npm start`.

## V45 ULTRA answer-key behavior
Known demonstration/practice titles use a deterministic pinned answer key so model output cannot change those answers. The key is limited to public UDC Summary-supported abridged classes and does not claim licensed MRF coverage. `Dictionary of Language and Literature` is pinned to `80` (general questions relating to linguistics and literature/philology).
