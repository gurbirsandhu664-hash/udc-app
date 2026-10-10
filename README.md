# UDC/DDC Classifier — V96

## Classification provider order
1. **DeepSeek** (`DEEPSEEK_API_KEY`, optional `DEEPSEEK_MODEL`, default `deepseek-chat`) is the primary provider.
2. **Groq** (`GROQ_API_KEY`, optional `GROQ_MODEL`) is a best-effort quality guard for the candidate answer. If Groq is unavailable or rate-limited, the original candidate is retained and marked accordingly.
3. If DeepSeek fails, **Groq** is attempted as the recovery provider before Gemini, further reducing Gemini requests.
4. **Gemini** (`GEMINI_API_KEY` or `GOOGLE_API_KEY`, optional `GEMINI_MODEL` / `GEMINI_PRO_MODEL`) is the last-resort fallback only if both DeepSeek and Groq recovery fail. This avoids routine Gemini requests, but no provider can guarantee its own quota will never be exhausted.

API keys must be set as server-side environment variables on the hosting provider. Do not add them to `index.html` or commit them into the ZIP.

## Bundled reference sources
- `udc-1961-reference-index.json`: searchable extracted text from the uploaded *B.S. 1000A:1961, Universal Decimal Classification, Abridged English Edition, 3rd edition revised 1961*.
- `ddc-23-reference-index.json`: searchable extracted text from all four uploaded DDC-23 volumes (volumes 1–4). The server ranks matching page excerpts for each title and passes them to the classification/guard providers.
- These JSON files are read-only bundled reference data. There is no shared-index toggle, shared-index database/API, browser PDF uploader, or browser backup/restore workflow.
- The reference index helps ground answers but does not make every AI answer guaranteed correct. Exact title keys and notation separation checks remain in place; unsupported notation should not be represented as schedule-verified.

## Run
- Node.js 20+ recommended.
- `npm install`
- `npm start`
- The service listens on `PORT` or port `10000` by default.
- `GET /api/health` reports provider configuration and bundled reference page/volume counts.

## Required files
Keep `server.js`, `index.html`, `package.json`, `udc-1961-reference-index.json`, and `ddc-23-reference-index.json` in the same deployment directory.
