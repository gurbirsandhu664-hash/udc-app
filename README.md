# UDC Ultimate V12 — Key-Loaded Final

Actual answer-key entries: 2700.

V12 loads `udc-2600-key.json` at server startup, refuses to report healthy when fewer than 2700 entries are loaded, checks exact normalized/punctuation-insensitive titles first, and exposes `/health` with the loaded count.

Critical exact rules:
- English Drama -> 821.111-2
- Hindi Language -> 811.214.21
- Science and Technology -> 5/6
- Science and Arts -> 5+7
- Heart Disease -> 616.12
- Library Classification: A Practice Manual -> 025.42

This is a practice classifier, not a reproduction of the licensed complete UDC Master Reference File.
