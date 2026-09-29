# UDC AI Classifier V12.5 — Dual Authority

V12.5 adds an explicit authority hierarchy:

**Licensed current UDC MRF > Official UDC Summary > deterministic current-UDC rules**

The project never mixes the historical 1961 schedule with current UDC.

The UDC Consortium says the MRF is the definitive authorized UDC version and is distributed under licence. The UDC Summary is a much smaller public subset (around 2,600 classes versus more than 70,000 entries). Therefore the app distinguishes `FULL_MRF_AUTHORITY` from `UDC_SUMMARY_SUBSET`.

## Why this matters
A keyword/index hit such as `unrest` must not be allowed to choose an unrelated notation such as a Pan-Slavism class. The title is analyzed as a whole before authority validation.

## Import
- Licensed current MRF: `/api/reference/import`
- Official UDC Summary export: `/api/authority/summary-import`

## Important
A complete exact classifier for arbitrary titles requires the licensed current MRF/complete current UDC authority. This release does not bundle a copyrighted MRF.
