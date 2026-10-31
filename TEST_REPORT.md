# V148 validation

Node.js 24.22.1. Automated API/script regression suite: 18 tests passed, 0 failed.

Checks include:
- HTTP startup, health, bundled references and public page.
- Internal files and both server modules return 404 publicly.
- Empty/non-string/oversized titles, malformed JSON, oversized bodies, invalid summaries and invalid main-subject selections.
- Twelve varied baseline title inputs; title preservation and separate UDC/DDC fields; repeatability.
- Browser-script syntax and V148 page labels.
- Bus/car/truck repair and maintenance cases; negative qualifier/computer-bus cases.
- New interdisciplinary titles: quantum biology, artificial intelligence in education, medical ethics and economic history.
- Explicit main-subject selection resolves an ambiguous AI/education title without silently encoding India or its date range.
- An opaque title with an astronomy summary receives astronomy candidates while retaining the original title.
- Punjabi agriculture/education detection.
- Unseen electroplating/nickel title receives independent ranked UDC and DDC reference passages.

Additional simulated DOM integration checks, using jsdom against a real local HTTP server, passed with no DOM errors:
1. Subject choices render for an ambiguous title.
2. Selecting education and classifying again renders the DDC candidate.
3. The bus-repair regression displays 629.287233.
4. An opaque title with an astronomy summary displays the astronomy candidate.

The DOM checks are simulated; they are not real-browser, iOS, rendering, microphone or accessibility certification. Live Gemini/Annif calls, production concurrency and exhaustive classification accuracy were not tested.

Rerun the included regression suite with `npm ci` followed by `npm test`.
