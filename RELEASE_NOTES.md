

## V99 — iOS/Safari source-rendering fix
- Validate source links before assigning `href`; malformed model source values are shown as plain text instead of throwing a browser pattern error.
- Normalize source entries on the server and keep a valid classification response even when a source citation is malformed.
- Preserve DeepSeek primary, Groq quota guard/recovery, Gemini secondary, and bundled read-only UDC-1961/DDC-23 references.
