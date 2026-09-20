UDC One-Click V46 MAX

Replace only index.html, server.js, package.json. Do not deploy seed-udc.json; this build does not require it.

Required environment: GEMINI_API_KEY and/or GROQ_API_KEY.
Optional model overrides: GEMINI_MODEL, GEMINI_PRO_MODEL, GROQ_MODEL.

Architecture: UDC Summary-first deterministic rules, Gemini 3.8 Flash + Gemini 3.1 Pro Search-grounded first wave, Groq Compound/GPT-OSS/Qwen failover, retry, independent jury corroboration, no broad fallback classmark, UDC-only guard.

Gemini model IDs verified against Google AI documentation on 2026-09-20. Groq model IDs verified against Groq documentation.
