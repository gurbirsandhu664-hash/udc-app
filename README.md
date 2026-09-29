# UDC AI Classifier V30

UDC-only classifier using the supplied **B.S. 1000A:1961 Abridged English UDC** reference.

## V30 key fix
V30 adds a deterministic **answer-key layer before Gemini**. Exact known titles are answered from `answer_keys.json`; Gemini is used only when a title is not in the exact key layer.

This prevents Gemini from changing a fixed answer such as `History of India` into an unrelated number.

The supplied 1961 UDC alphabetical index explicitly lists **India — history 954**, **China — history 951**, and **Korea — history 951.9**. The app therefore uses those numbers for those exact titles in V30.

## Render
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variable: `GEMINI_API_KEY`
- Optional: `GEMINI_MODEL`

## Files
- `server.js`
- `package.json`
- `answer_keys.json`
- `udc_reference.txt`
- `.gitignore`

## Important
This app is based on the supplied 1961 abridged reference. For titles whose exact notation is not established by that reference, the app falls back to Gemini with the supplied reference excerpts and clearly asks for verification instead of inventing a number.

UDC only — never DDC.
