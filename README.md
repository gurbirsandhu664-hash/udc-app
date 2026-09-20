# UDC Precision V52 — Google Quota-Safe

- No jury / voting.
- Google Gemini primary + model fallback.
- Quota-safe: stops retrying an exhausted project and can rotate to independent Google project keys.
- Verification pass is OFF by default to avoid wasting quota; set `UDC_VERIFY_PASS=true` only when desired.
- Never exposes raw 429/quota errors to the browser.
- Does not invent a UDC number when Google cannot verify one.
- Seed JSON is not required.

Environment:
- GEMINI_API_KEY (required)
- GEMINI_API_KEY_2 ... GEMINI_API_KEY_5 (optional; use keys from independent Google projects for real quota separation)
- MAX_MODELS_PER_REQUEST=2 (optional)
- UDC_VERIFY_PASS=false (recommended for quota safety)

Important: Gemini quotas are applied at the project level, not simply per API key. Multiple keys from the same project do not create extra quota.
