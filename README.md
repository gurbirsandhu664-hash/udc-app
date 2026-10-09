# UDC One-Click V61 STRICT

Complete stable V45 UDC classifier bundle. Uses UDC as the primary classifier and includes a clearly separated DDC Section D practice answer key. UDC and DDC answers are never mixed.

Start with `npm start`.


V61 DEEP ACCURACY
- Historical UDC authority context locked to B.S. 1000A:1961, Abridged English Edition, 3rd edition, revised, London.
- UDC and DDC are independently classified and explicitly separated.
- Exact-title rules run before AI/provider guesses.
- Unknown UDC results are explicitly marked UNVERIFIED rather than presented as authoritative.
- Added controlled exact-title rules for Design and Construction of Cement Floor, Electrotherapy for Economically Useful Animals, and Snake Farming in South India.


## V61 strict synthesis
DDC now has deterministic exact-title keys for configured single and multiple synthesis examples. UDC syntax is explicitly guarded: `+` coordination, `/` extension, `:` relation, `::` order-fixing, and subgrouping only where authorized. DDC synthesis is never inferred from UDC notation.


## V61 DEEP STRICT — Club-house architecture protection
- Exact title family: Architecture of Club Houses for the Aged / Aged People / Elderly People / Older People.
- UDC protected answer: 72:362.6 (Architecture related to the aged).
- DDC 23 protected answer: 728.4043.
- The DDC key explicitly rejects 727.6 and 725.56 for this exact club-house title.
- Wording normalization covers club house/clubhouse and aged/the aged/aged people/elderly/older people.

### iOS Chrome voice note
On iPhone/iPad Chrome, use VOICE SEARCH to focus the title field, then tap the microphone key on the iOS keyboard. Wait for the dictated title to appear, review it, and tap CLASSIFY. If the keyboard microphone is missing, enable Dictation in Settings > General > Keyboard. iOS Chrome may not expose in-page Web Speech recognition, so this fallback depends on iOS keyboard Dictation being enabled.


DDC-23 reference note: user-supplied Volume 1–4 scans may be consulted as reference during development, but their copyrighted full text is not embedded or redistributed in this package. Interdisciplinary works must be classified by the discipline receiving the fullest treatment where no DDC interdisciplinary number is provided.


## V66 — DDC-23 four-volume reference search
- Added browser-local PDF indexing for user-supplied DDC-23 Volumes 1–4.
- Matching excerpts show source filename and PDF page and can be supplied as evidence to the classifier (max 7,000 characters).
- PDF contents are not uploaded as a full corpus or bundled into this package; only short query-matched excerpts may be sent to the classification API.
- The PDF.js library is loaded from cdnjs, so the reference reader requires a network connection. Indexing is session-local; select the PDFs again in a new browser session.
- Exact configured DDC answer keys remain deterministic and take precedence over model output. Reference excerpts are evidence, not automatic guarantees of correctness.


V68 — PERSISTENT DDC-23 REFERENCE INDEX
- Saves extracted PDF page text in browser IndexedDB when available, and reloads it on the next visit in the same browser profile.
- Adds a CLEAR SAVED INDEX control.
- Limits stored extracted page text to 2,600 characters per page to reduce browser storage pressure.
- Original DDC-23 PDF files are not embedded, uploaded, or redistributed. User selects their own PDFs to build the local text index.
- Persistence depends on browser storage quota/settings; private browsing or storage clearing may remove it.


V68 verification fix: startup now waits for IndexedDB reference-index restoration before allowing CLASSIFY to search reference evidence. The app requests persistent browser storage when supported, so the saved index is less likely to be evicted. This still depends on same browser + same deployed origin; browser/site-data clearing or another device/browser requires rebuilding the index.
