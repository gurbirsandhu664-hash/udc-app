# V112 — CLASSIFY watchdog fix

- Keeps the UDC 1961 index and DDC-23 reference corpus.
- Keeps the existing classification handler intact.
- Adds a watchdog: if the original handler does not initiate `/api/classify` within 1.8 seconds after a title is submitted, a fallback sends the complete title directly to the same endpoint.
- Shows browser/server errors visibly and restores the CLASSIFY button after fallback requests.
- ZIP entries are at the archive root for Render projects configured to use that root.

Local checks: archive layout and JavaScript syntax. Live Render behavior must be verified after deployment.
