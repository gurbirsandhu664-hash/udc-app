# V149 validation

Environment: Node.js 24.22.1. `npm test`: 36 test cases passed, 0 failed.

## Classification checks

- Reproduces the reported "Heart Cancer in Dogs" case through the HTTP API: historical UDC candidate 619:616.12-006.6:636.7; DDC candidate 636.7089699412.
- Clinical rule matrix covers 30 combinations of six domestic hosts and five organs; checks separate UDC and DDC construction.
- Human organ cancer, animal organ disease without cancer, medical aliases and a Punjabi example.
- Negative cases: mixed hosts, multiple/unsupported organs, economic/social/literary perspectives, benign or unsupported named conditions, prevention and unknown animal hosts.
- Additional place, time and treatment facets stay explicit when not encoded.
- Existing bus/car/truck and interdisciplinary-title regressions remain passing.
- A specific crop class is preserved instead of being replaced by broad agriculture.
- Malformed multi-decimal DDC numbers and commentary-only fields are withheld.
- Referenced DDC instructions and the explicit heart-cancer example are checked against the supplied page excerpts.

## Integration and infrastructure checks

- Startup, homepage, health and reference availability.
- Source and dependency paths remain inaccessible publicly, including every new module.
- Invalid title, summary, focus, body size and JSON inputs return appropriate errors.
- Full-title preservation, repeatability, script syntax and V149 labels.
- Mocked Gemini 2.5 request uses structured output without incompatible search tools.
- Mocked provider success accepts independently valid identical UDC/DDC strings; mocked outage falls back without exposing raw errors or credentials.

Additional simulated DOM checks against a local HTTP server passed with no DOM errors. They exercise main-subject selection, summary input, bus repair and the canine heart-cancer result. Both final numbers, populated sources and the component-proof panel are checked. The wording audit is collapsed by default.

## Not validated

A real browser could not be installed: the browser download was unavailable/truncated in this environment. Simulated DOM checks do not establish actual iPhone rendering, speech behavior or accessibility. No live Gemini/Annif request, production concurrency benchmark, live deployment verification or exhaustive cataloguing review was performed. Existing legacy title rules have not all been independently audited.

The clinical cases are finite rule coverage, not a guarantee of correct classification for every possible title. See CLASSIFICATION_EVIDENCE.md.
