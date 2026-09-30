# UDC AI Classifier — V33 upgraded (1961 locked)

This is an upgraded V33 build. The public version label remains **V33** as requested.

## Classification basis
- Universal Decimal Classification (UDC), B.S. 1000A:1961, Abridged English Edition, 3rd Edition Revised 1961.
- UDC only. Never DDC.
- Deterministic answer keys are checked before AI.
- Compound titles are handled with UDC relationship/coordination notation where appropriate.
- The supplied 1961 reference is searched with phrase-aware retrieval before Gemini classification.
- Unfamiliar titles do not return a server error. If AI is unavailable, the app returns a clearly labelled local/provisional result.

## Important fixed examples
- History of India -> 94(540)
- Higher Education and Computers -> 378:681.14
- Knowledge, Metaphysics and Logic -> 001+11+16
- Science and Art -> 5+7
- Handbook of Science and Technology -> 5/6(035)

## Render
Build: `npm install`
Start: `npm start`
Environment: `GEMINI_API_KEY` (recommended)
Optional: `GEMINI_MODEL`

The application dynamically discovers Gemini models that support `generateContent`, so it is not tied to one unavailable model name.
