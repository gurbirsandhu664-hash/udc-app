# V114 — backend title-rule fix

- Fixes a mismatch in V113: the browser-side exact-title rule returned provisional broad bibliography classes, but `/api/classify` still had an older early-return rule that returned empty numbers.
- The server now returns the same cautious provisional UDC 016 / DDC 016 for the exact ambiguous title, clearly labeled provisional and not schedule-verified.
- Does not convert “and” to “on” or append a social-welfare subdivision without evidence.
- Keeps UDC 1961 and DDC-23 bundled reference files and V112 classify watchdog.
- Flat ZIP root preserved for Render.

Local checks: archive integrity and server/browser JavaScript syntax. Live Render deployment has not been verified.


## V115 — UI version label correction
- Corrected the visible HTML page title and on-page version badge to V115.
- Updated server engine version metadata and package version.
- No classification rules or reference-index data changed from V114.


## V116 — exact-title classification fix
- Replaced the provisional 016/016 result for “A bibliography of writings and social welfare” with UDC 016:36 and DDC-23 016.361 as separate complete notations.
- Applied the same rule in both browser and server handlers.
- Preserved the user-entered full title and added a note about interpreting the title as a social-welfare bibliography.
- No reference-index data was altered.


## V117 — Collective biography UDC auxiliary rule
- Added exact-title handling for “A collective biography of prominent people of India from the 20th century”.
- Full notation returned as `92(540)"19"` with India and 20th-century auxiliaries preserved.
- Marked as pending printed-schedule verification; not claimed as an exact licensed MRF lookup.
- Updated HTML page title, engine version and package version to V117.


## V118 — Exact-title article alias fix
- Fixed browser exact-title lookup for “A collective biography of prominent people of India from the 20th century”.
- The leading article “A” now resolves to the same full notation rule as the title without the article.
- This exact-title lookup runs before the saved-result cache, preventing a stale cached `92` result from winning.
- The UDC notation `92(540)"19"` remains marked as pending printed-schedule verification.


## V119 — visible HTML version badge correction
- Corrected the actual H1 badge in index.html. V118 had changed the browser tab title but left the visible page badge at V117.
- Updated HTML title, engine metadata and package version to V119.
- No classification authority has been independently verified by this UI-label correction.


## V120 answer-key correction
- Pinned the exact title “Collective Biography of Prominent People of India from the 20th Century” to UDC `92(540)"19"`.
- Prevented the incorrect mixed-notation form `92(915.4)` from being returned for this title.
- Added a separate DDC-23 constructed candidate `920.0095404`; the UI note explicitly says to verify the complete synthesis against the institution’s DDC-23 schedule.
- Preserved the full notation and kept UDC/DDC fields separate.


## V122 — strong index.html version update
- Updated the browser page title and visible on-page version badge to V122.
- Updated backend engine version metadata and package version to 122.0.0 so the release label is consistent.
- Preserved the V121 exact-title UDC key and separate DDC candidate key; no new classification number is claimed as verified.
- Kept all bundled UDC 1961 and DDC-23 reference index files intact.
- Render deployment is not automatic; upload/deploy this ZIP to make the live website show V122.


## V123 — crash-safe UDC notation guard
- Fixed `ALL_TITLE_GUARD_INVALID_UDC_NOTATION`: malformed or empty generated UDC notation no longer throws out of the request path and can no longer crash the Node/Render process.
- If a syntactically valid local UDC candidate exists, the guard restores it; otherwise the UDC candidate is withheld with an explicit recoverable warning rather than inventing a number.
- Preserved the full title, bundled UDC 1961 and DDC-23 reference indexes, and existing classification rules.
- Updated browser title/badge, engine metadata and package version to V123.
- Static syntax and ZIP integrity checks should be run before deployment; live Render behavior still requires redeployment and testing.


## V124 — prevent notation-guard crashes and preserve mobile result visibility
- Removed the remaining throw from the UDC/DDC separation guard. If the two generated values are identical and no independent local UDC answer exists, the UDC candidate is withheld with a recoverable warning instead of throwing from the async request handler.
- Fixed the UDC warning field being appended to the DDC note.
- Added mobile-safe wrapping for long notation and explanation fields to reduce horizontal overflow and make answer fields remain visible.
- Updated the release version to V124.
- Validation required after deploy: `/api/health`, then classify a known title and a new title. Live Render behavior cannot be confirmed from this local patch.


## V125 — exact-title recovery for Punjabi idioms
- Added deterministic server and browser handling for the exact title “idioms and expression in Punjabi language”.
- Restores the configured full UDC notation `811.214.27.18` instead of allowing a generic AI response to replace it.
- DDC is explicitly marked “Not verified” until the relevant DDC-23 schedule instruction is confirmed; no DDC number is invented.
- Changed the browser result-cache namespace to V125 so older cached generic results are not reused.
