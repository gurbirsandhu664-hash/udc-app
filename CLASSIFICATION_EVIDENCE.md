# V149 classification evidence and scope

## Heart Cancer in Dogs

Constructed historical UDC candidate: `619:616.12-006.6:636.7`.
Constructed DDC-23 candidate: `636.7089699412`.

These are synthesized results, not claims of a verbatim, exact authority lookup.

UDC components:
- The supplied UDC 1961 excerpt at PDF page 85 gives 619 for veterinary medicine and instructions relating it to specific diseases and domesticated animals.
- The supplied index at PDF page 190 identifies heart pathology at 616.12.
- The supplied index at PDF page 160 identifies carcinoma at 616-006.6.
- The public UDC Summary independently identifies dogs at 636.7: https://udcsummary.info/php/index.php?id=50820&lang=en . The current Summary supplies a species cross-check; it does not certify a complete historical synthesis.

DDC-23 steps:
1. Volume 3, PDF page 126 (printed page 124), explicitly provides 616.99412 for cancer of the heart. Cancer of an organ is built under the cancer schedule, rather than by appending arbitrary cancer digits to 616.12.
2. Volume 3, PDF page 334 (printed page 332), gives the veterinary instruction to add the digits following 61 in the medical schedules.
3. Volume 3, PDF page 343 (printed page 341), gives the dog-specific base and add instruction. The dog veterinary base is 636.7089.
4. Digits following 61 in 616.99412 are 699412. Append those digits to 636.7089: 636.7089699412. A decimal point inside the appended digits must not be copied.

The supplied DDC-23 text is the source for these add instructions. The test suite also checks that the heart-cancer example and relevant add instructions exist in the supplied excerpts.

## Clinical rule coverage

The module recognizes dogs, cats, horses, cattle, pigs and sheep; heart, lungs, liver, kidneys and skin; general organ disease and explicit cancer. It recognizes several English medical aliases and a small number of Punjabi aliases.

Multiple hosts, multiple organs, unsupported organ names, benign/other named conditions and nonclinical perspectives do not receive a fabricated single-host cancer synthesis. Some fall back to broader candidates or require schedule/context review. Place, period, form and treatment qualifiers are surfaced as unencoded facets when appropriate. Unknown animal hosts are not defaulted to human medicine.

## Provider compatibility evidence

The request policy keeps structured JSON output, and omits built-in search from Gemini 2.x structured requests. Google's structured-output documentation limits structured-output-plus-tools support to later model families:
https://ai.google.dev/gemini-api/docs/generate-content/structured-output

The integration tests intercept the vendor endpoint with a local fixture to validate the actual outgoing request shape and response/failure paths. They do not call a live paid model or prove live account access.

## Corpus limitation

251 of the 253 bundled UDC page records have exactly 2600 characters. This strongly suggests that much of the original page text was clipped before this task. There are also clipped and empty records in the DDC index. The indexes are not complete replacement schedules. This release preserves the supplied bytes and exposes this limitation; it does not reconstruct missing text.

A full accuracy guarantee for arbitrary titles cannot be made from incomplete excerpts, keyword rules and unverified model output.
