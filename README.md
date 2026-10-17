## V141 — Country + century title recovery

- Added a deterministic title-specific rule for “Social History of the United States in the 20th Century”.
- UDC candidate: `94(73)"19"` (history + United States + twentieth-century time auxiliary).
- DDC candidate: `973.9` (United States history, twentieth century).
- Keeps the social-history perspective explicit and states that narrower social-history synthesis is not independently verified.
- UDC and DDC remain separate; does not claim universal accuracy for arbitrary titles.

# UDC/DDC Classifier — V134 Integrated Accuracy Build

This package consolidates the previous V127–V133 project work into one deployment package. It is designed to reduce unsupported answers; it does **not** guarantee every random title will be classified correctly.

## Included
- UDC B.S. 1000A:1961 reference index and DDC-23 Volumes 1–4 reference index (bundled JSON files).
- Existing deterministic exact-title rules and subject fallback.
- Gemini server-side assistance when `GEMINI_API_KEY` or `GOOGLE_API_KEY` is configured.
- Title coverage audit, UDC/DDC field separation, notation-format checks, and conservative evidence status.
- Full-title preservation and versioned browser cache namespace.
- Subject-first guard for “Dictionary of the Doctrines of Eastern Churches”; broad subject candidates are explicitly not called fully verified.
- Safeguards for “Social Welfare Services for Cancer Patients” so broad UDC 36 is not presented as a complete title-specific answer.
- Existing Annif endpoint integration support and provider registry for WebDewey, WorldShare AI, UDC Online and Annif; external providers are clearly shown as disconnected until configured and tested.
- Existing project reference files preserved in this package. This package does not implement a new shared-database write lock; do not use it as proof that an external saved index is protected.

## Important accuracy limitation
A title-word coverage audit only checks whether title concepts appear in the explanation; it does not prove the classification number is correct. The app labels results as candidates unless explicit schedule-level evidence is provided. Licensed OCLC/UDC services are not live-connected merely because they appear in the interface. Random titles still need testing against authorized schedules and library catalogues.

## Deploy safely
1. Download a backup of the current GitHub repository and preserve the existing saved index.
2. Extract this ZIP locally. Do not upload the ZIP itself as a repository file.
3. Replace the matching project files in the repository with the extracted files; keep the two reference-index JSON files in the same root directory.
4. Commit to the branch connected to Render (shown previously as `main`).
5. Confirm Render's build succeeds and the service is Live.
6. Test several titles from unrelated subjects. Check UDC and DDC separately, and do not treat a candidate status as authority verification.

## Run
- Node.js 18+ (Node.js 20+ recommended)
- `npm install`
- `npm start`
- Keep API keys only in Render Environment Variables, never in `index.html` or GitHub.

## Required root files
`server.js`, `index.html`, `package.json`, `udc-1961-reference-index.json`, and `ddc-23-reference-index.json`.


## V135 behavior correction
Unknown titles no longer receive UDC 0 just to make the answer non-empty. Jewish religious calendar titles receive only the broad UDC 26 Judaism candidate, clearly marked for authority verification. This is safer than claiming a detailed notation without schedule evidence.


## V136 hotfix — National Anthem titles

- Recognizes national anthem titles as music rather than returning an unresolved blank result.
- Uses UDC 784.7, supported by the bundled B.S. 1000A:1961 alphabetical index entry “national anthems”.
- Shows DDC 782.42 only as a broad songs candidate and explicitly says the country-specific DDC synthesis still needs the instructions under 782.1–782.4.
- Does not claim a fully verified country-specific DDC number.


## V139 random-title coverage fix
- Added populated subject-term analysis for titles without a defensible notation match.
- Keeps the full title, subject-term candidates, explanation, confidence/evidence, notation audit, sources, and DDC note visible.
- UI explicitly displays “No defensible UDC number yet” / “No independently verified DDC number yet” instead of hiding empty number cards.
- Does not invent numeric classifications when the bundled reference corpus cannot support them.


## V140 — random-title recovery + independent DDC candidates
- Fixed double-escaped word-boundary expressions in the last-resort UDC classifier that prevented many keyword rules from matching at all.
- Added a separate broad DDC candidate map for common subject families when no exact DDC key exists; exact-title keys retain priority.
- Broad candidates are explicitly labelled not authority-verified; this improves recovery without pretending every arbitrary title has a fully verified shelf number.
- Preserves full-title audit and keeps UDC/DDC notation separate.
- Requires Render deployment to affect the live app; this ZIP has not been deployed automatically.
