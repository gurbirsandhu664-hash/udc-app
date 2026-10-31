# V146 validation

Tested with Node.js 24.22.1. `npm test`: 8 tests passed, 0 failed.

- HTTP startup, homepage, security headers and health reference-index availability.
- Public access denied for server.js, package.json, README, dependencies, .env and script-copy files.
- Empty, object, array, number and null titles rejected.
- Titles over 1000 characters, malformed JSON and request bodies over 64 KiB rejected with correct error statuses.
- Twelve title inputs: exact rules, history, national anthem, social history, bibliography, unknown text, Punjabi and HTML-like input. Successful responses retain full titles, separate UDC/DDC string fields and coverage auditing.
- Repeat requests produce consistent class numbers.
- Both browser scripts parse successfully, with one server classification path and an abort signal.

Not completed: real browser interaction (Chromium executable unavailable in the test environment), iOS speech recognition, live external provider calls, production load testing, and independent cataloguing verification. There is no claim that all possible app errors or classification inaccuracies have been eliminated.

Rerun with `npm ci && npm test` after future changes.

- Page title, visible version badge and release description show V146.
