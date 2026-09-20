UDC AI CLASSIFIER v48.1 — GEMINI SEARCH FIX
=============================================

WHY THE OLD VERSION FAILED
The screenshot shows the frontend falling back to "Not resolved" because the backend did not return a usable UDC result. A better frontend alone cannot solve a missing/broken AI endpoint.

THIS BUILD FIXES THE ARCHITECTURE
- index.html calls /api/classify.
- server.js calls Gemini from the server, so the API key is NOT exposed to users.
- Gemini Search grounding is enabled.
- The prompt forces UDC-only classification and forbids DDC substitution.
- JSON and error handling are explicit.
- /api/health is available for Render testing.
- Existing local seed/reference data remains only as a practice/browser dataset.
- Unknown titles are marked REQUIRES VERIFICATION instead of getting a made-up official number.

FILES
1. index.html
2. server.js
3. package.json
4. .env.example
5. udc-reference.json
6. README.txt

RENDER
Set:
Build Command: npm install
Start Command: npm start
Environment Variable:
GEMINI_API_KEY = your Gemini API key

OPTIONAL:
GEMINI_MODEL=gemini-2.5-flash

IMPORTANT
Do NOT put GEMINI_API_KEY inside index.html or GitHub.
The UDC Consortium says UDC has 72,000 subdivisions and is maintained/distributed through the Consortium and licensed publishers. This package does not reproduce a proprietary complete UDC table. For authoritative production classification, use authorized/licensed UDC reference material.
