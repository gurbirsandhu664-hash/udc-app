# V101 — Groq primary; DeepSeek removed

- Removed DeepSeek API-key/model configuration, request function, and provider route.
- Groq now handles AI classification first.
- Gemini remains the optional last-resort fallback when Groq fails.
- Updated UI, health endpoint, and documentation to show the new provider order.
- Preserved Wikipedia supplementary subject context, bundled UDC 1961 and DDC-23 references, and deterministic title rules.
- Wikipedia remains context only and is not treated as a classification authority.


## V102 provider priority update
- Gemini is now the primary AI classifier.
- Wikipedia subject context is retrieved alongside the bundled UDC 1961 and DDC-23 reference evidence. Wikipedia is not treated as a classification schedule or authority.
- Groq is only a fallback if Gemini is unavailable or fails.
- DeepSeek remains removed.
