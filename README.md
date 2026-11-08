# UDC / DDC Classifier — V149

## Run
Use Node.js 22 or newer (24 recommended):

```sh
npm ci
npm test
npm start
```
Open http://localhost:10000. Hosting uses the PORT environment variable.
Build command: `npm ci`. Start command: `npm start`. Health check: `/api/health`.

## V149 corrections
- Clinical classification now identifies the animal host, affected organ and cancer/disease context instead of returning only 61/610.
- Supported clinical facets are composed into separate UDC and DDC constructions, with component citations and explicit unencoded qualifiers. See CLASSIFICATION_EVIDENCE.md for finite coverage.
- Specific local candidates are preserved instead of being overwritten by broad subject families.
- Gemini 2.x structured requests omit incompatible built-in search tools; the actual request and failure paths are tested with a mock endpoint.
- The computing-class guard no longer rejects historical .004 auxiliaries; identical independently valid class strings are not rejected solely because they match.
- Malformed notation and prose values are withheld. The UI no longer extracts missing numbers from descriptive text.
- Both numbers appear near the top; the long wording audit is collapsed; sources and number-building steps remain available.
- Index limitations are disclosed: many supplied page excerpts are clipped. Missing text has not been reconstructed.

## New and complex titles
- Thirty subject families, including some Punjabi subject aliases, can be detected across titles and optional summaries.
- A title can have several subject interpretations. The app shows separate broad UDC and DDC alternatives and lets the reader select the main focus and classify again.
- Place, period, document form and relationship words are detected separately. They are not silently appended as unverified subdivisions.
- For unclear titles, enter a subtitle, short summary or contents description (up to 4000 characters).
- Both bundled reference corpora use ranked retrieval with inverse document-frequency weighting, length normalization and matched-term coverage. Related passages and PDF-page references are displayed for review, including technical titles outside the subject-family list.
- Ranked passages are related evidence, not proof that a candidate number or synthesis is correct.

The previous vehicle-repair fix is included. "Repair of buses" produces historical UDC candidate 629.114.5.004.67 and DDC 629.287233. The UDC .004 point-of-view auxiliaries were subsequently withdrawn: these rules target the configured historical classification, not current UDC.

## Deploy the whole package
Extract the ZIP. Put all files at the project root, including server.js, medical-classification.js, provider-policy.js, result-quality.js, subject-engine.js, vehicle-classification.js, index.html, package.json, package-lock.json and both JSON reference indexes. A browser-file-only update cannot install these server changes. The page and `/api/health` should show V149.

No account or API key is required for local rules, subject analysis or bundled retrieval. Optional server environment variables: GEMINI_API_KEY (or GOOGLE_API_KEY), GEMINI_MODEL, GEMINI_PRO_MODEL, ANNIF_API_URL, ANNIF_PROJECT_ID, ANNIF_API_TOKEN. A configured model may assist eligible requests; deterministic rules and unresolved subject selection still take priority. Never put real credentials in browser code or commit a real .env file.

## Included safeguards
One server classification path; bounded request/provider timeouts; validated input; private source files are not served; correct HTTP error statuses; safe text rendering; explicit HTTP(S) citation links; dependency lockfile; regression tests. inline-0.js and inline-1.js are synchronized copies of the embedded page scripts.

## Limits
This update expands coverage and makes ambiguity reviewable. It does not guarantee correct complete classifications for every title. Thirty subject families are not an exhaustive subject thesaurus; the Punjabi aliases are partial. Broad candidates do not encode every qualifier. A detected concept or a retrieved page is not an authority-verified shelf number. Existing configured rules remain in the project and were not all independently audited. This is a finite improvement, not a universal accuracy guarantee.

Real iPhone/browser interaction, microphone behavior, live external providers and production load were not tested. See TEST_REPORT.md.
