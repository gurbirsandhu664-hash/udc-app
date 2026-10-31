# UDC / DDC Classifier — V146

## Run
Install Node.js 22 or newer (Node.js 24 recommended), then open this folder in a terminal:

```sh
npm ci
npm test
npm start
```
Open http://localhost:10000. On hosted services, the server uses the `PORT` environment variable.

## Deploy
Build command: `npm ci`
Start command: `npm start`
Health check: `/api/health`
Extract the ZIP and deploy the extracted files, including both JSON reference indexes and package-lock.json. Do not upload the ZIP itself as the web application.

No credentials are needed for local rules and bundled reference retrieval. Optional server environment variables: GEMINI_API_KEY (or GOOGLE_API_KEY), GEMINI_MODEL, GEMINI_PRO_MODEL, ANNIF_API_URL, ANNIF_PROJECT_ID, ANNIF_API_TOKEN. Never put credentials in browser code or commit a real .env file.

## V146 fixes
- All classification requests use one server path, including exact-title rules and evidence auditing.
- Removed browser answer overrides, stale result-cache reads and duplicate watchdog requests.
- A request times out after 40 seconds; external model attempts share a 30-second budget (maximum two models).
- Source code, package files, dependencies and secrets are no longer publicly served.
- Invalid JSON, non-string titles, oversized requests and server errors return proper HTTP error statuses.
- Text citations stay text; only explicit HTTP(S) URLs become links.
- Reproducible dependency lockfile and regression tests included.

## Accuracy and test limits
Configured rules and broad candidates remain suggestions requiring schedule verification. These changes do not establish that every UDC/DDC number is correct. No live Gemini, Annif, mobile microphone or hosted-domain reputation test was performed. A browser malware/reputation warning is not cleared by updating this ZIP; review the deployed host separately if a warning remains.

See TEST_REPORT.md for completed checks. inline-0.js and inline-1.js are synchronized copies of the scripts embedded in index.html; the page runs its embedded scripts.
