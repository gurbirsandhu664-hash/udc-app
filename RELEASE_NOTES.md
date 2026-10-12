# V111 — resilient CLASSIFY fix

- Keeps the bundled UDC 1961 reference index and DDC-23 Volumes 1–4 reference corpus.
- Adds a capture-phase fallback for CLASSIFY: if the original client handler is missing or crashes before it starts, the button submits the title directly to `/api/classify`.
- Adds visible browser JavaScript/unhandled-rejection diagnostics and always restores the button after fallback requests.
- Does not invent classification numbers; server errors are shown on the page.
- Flat archive root preserved for Render deployment.

Checks: ZIP layout, server JS syntax, main page JS syntax, and fallback script syntax checked locally. Live Render runtime still requires deployment to verify.
