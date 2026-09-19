# UDC Ultimate V17 — Google Verify

## What this version does
1. Checks the local `udc-2700-key.json` first.
2. Also reads `udc-2600-key.json` if present.
3. Uses exact/strong whole-phrase matching; it does not invent a UDC number when no local match exists.
4. If Google credentials are configured, searches Google for the title + UDC and shows the source results inside the app.
5. If Google is not configured, it provides a direct Google search link instead.
6. Google results are treated as discovery/verification material, NOT as an authoritative UDC database.

## Keep your existing key files
Copy your existing `udc-2700-key.json` into this folder before deployment. You can also keep `udc-2600-key.json`.
Do NOT delete `package.json`.

## Google setup
This project expects:
- `GOOGLE_API_KEY`
- `GOOGLE_CX`

Set these as Render Environment Variables, not inside the HTML or GitHub source.

Important: Google's Custom Search JSON API currently is closed to new customers and existing customers are being moved to alternatives. If you cannot obtain/use that API, the app still works with a direct Google search link. See the current Google documentation before relying on this integration.

## Render
Build Command: `npm install`
Start Command: `node server.js`

## UDC licensing
The UDC Consortium states that the UDC Master Reference File (MRF), the definitive authorised UDC database, is distributed under licence. Do not add or distribute the complete MRF unless you have the appropriate rights/licence.

This project intentionally does not contain a copied 70,000+ record UDC MRF.
