# V110 — UDC 1961 + DDC-23 schedule-grounded retrieval

- Confirmed and retained the bundled UDC B.S. 1000A:1961 reference index and DDC-23 Volumes 1–4 reference index.
- Improved server-side title-to-page retrieval with rare-term weighting, phrase matching, distinct-term coverage, and deterministic tie-breaking.
- Kept the UDC and DDC corpora strictly separate; the DDC search is limited to Volumes 1–4 and UDC search to the 1961 corpus.
- Expanded `/api/health` diagnostics with searchable-text page counts and retrieval mode.
- Preserved V109 title-wording guard and existing configured title rules.

Accuracy note: this improves evidence retrieval but cannot guarantee every generated class number is correct. OCR/index excerpts are evidence, not a substitute for checking the applicable schedule notes, tables, and synthesis rules.
