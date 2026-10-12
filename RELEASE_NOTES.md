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
