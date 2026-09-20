UDC AI CLASSIFIER v48 FIX
=========================

Replace ONLY these three files in the existing web project:
1. index.html
2. udc-reference.json
3. README.txt

What was fixed:
- The old build could silently fall back to the tiny local seed database when the backend response was not JSON.
- This build tries /api/classify, /classify, and /api/udc/classify.
- It accepts both JSON and plain-text/Markdown backend answers and extracts a UDC number when the backend returns one.
- Requests have a timeout so the button does not remain stuck.
- Exact/near local matches are used only when sufficiently supported.
- Unknown titles do NOT receive an invented “official” UDC number.
- UDC-only guard remains.
- History, Browse, Practice and mobile UI remain functional.

IMPORTANT:
The included udc-reference.json is a limited seed dataset, NOT a complete UDC Abridged Edition and NOT 72,000 official classes. For authoritative classification, connect the existing secure AI backend to an authorized/licensed UDC reference dataset.

If your existing Render service already has one of the supported POST endpoints, the frontend will use it automatically. No API key is placed in index.html.
