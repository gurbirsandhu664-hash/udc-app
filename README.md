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


## DDC-23 STRICT update
The DDC Section D engine now treats DDC 23 schedules, tables, add instructions, and built-number examples as the governing rules for DDC answers. Exact configured DDC keys override provider output; the engine rejects mechanical UDC→DDC conversion, arbitrary concatenation, and broad-parent fallbacks when a schedule authorizes synthesis. DDC and UDC remain separate fields.

Key verified library/psychology synthesis examples include 025.5277625 (Reference Service in Children’s Libraries), 025.5277665 (Reference Service in Prison Libraries), 025.2187665 (Book Selection in Prison Libraries), 025.21877 (Document Selection in University Libraries), 025.1977/025.197754 (Administration of University Libraries / in India), 025.27341 (Book Selection on International Law), 025.279737 (Book Selection on the History of U.S. Civil War), and 153.9402461 (Aptitude Test for Medical Professionals).


## V61.1 ACCURACY HARDENING
- Added a final DDC-23 acceptance gate: provider-generated DDC numbers are never exposed as final unless they match a configured DDC-23 schedule/add-instruction/exact-example key.
- Rejects DDC numbers containing UDC-only relation/auxiliary syntax and rejects DDC key conflicts.
- Added UDC notation-format and title-completeness gates.
- Preserves deterministic exact-title DDC answers while preventing arbitrary provider synthesis.
- Unverified DDC is now explicitly blank and labelled UNVERIFIED instead of being presented as authoritative.
- Added `accuracy_gate` metadata so the UI/API can identify the hardened engine.
- Existing UDC/ DDC separation and no-generic-fallback policy remain enforced.
