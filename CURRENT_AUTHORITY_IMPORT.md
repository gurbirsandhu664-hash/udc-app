# V12.5 Current Authority Import

## Priority
1. LICENSED_MRF — complete current authority
2. OFFICIAL_UDC_SUMMARY — official public subset
3. Deterministic current-UDC rules

Legacy 1961 data is never allowed to override current UDC.

## Licensed MRF
Export the licensed UDC MRF as XML/extended tagged text, parse it to:
- notation
- caption
- parent/broader
- references
- auxiliaries
- scope/notes
- history/change status

Then POST records to `/api/reference/import`.

## Official UDC Summary
The UDC Consortium provides the UDC Summary as a public subset. It contains around 2,600 classes from a scheme of more than 70,000 entries. Current 2026 Summary data is released under CC BY-NC 4.0 according to the Consortium website.

The app supports importing an official Summary export through `/api/authority/summary-import`.

IMPORTANT: the Summary is not the complete MRF. Do not label a Summary-backed answer as "full MRF verified".

## No edition mixing
The old B.S. 1000A:1961 file can remain in the project for historical diagnostics, but it cannot be used to override current-UDC answers.
