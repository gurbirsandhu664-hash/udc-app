# V103 — deterministic annual-report rule and repeatability fix

- Added a deterministic title key for **Annual report of Indian institute of public administration**.
- UDC answer: `061.2(540).055.5`, based on B.S. 1000A:1961 printed page 29 (institutions/associations and annual reports).
- DDC answer is kept independent and conservative at broad class `351`; no unsupported annual-report or geographic synthesis is appended.
- Added versioned browser-local result caching for other AI-generated titles. Protected title keys run before the cache, so the exact-title rule always wins.
- Repeated normalized titles on the same browser reuse the saved result rather than receiving a fresh variable model response.
- Existing setup remains Gemini primary, Wikipedia supplementary context, Groq fallback; DeepSeek remains removed.

Note: this improves repeatability and protects the stated title. It does not imply every unkeyed title is automatically authoritative; new title rules should be added only after checking the relevant UDC 1961/DDC-23 schedule instructions.
