# V87 — Answer recovery fix

- Allows a provider response with a valid UDC answer OR a valid DDC answer instead of rejecting it solely because the other field is empty.
- Tries additional configured Gemini fallback models even when an earlier provider returned a partial answer, merging non-empty fields without overwriting deterministic keys.
- Keeps UDC and DDC notation separate and preserves exact local answer keys.
- Voice recognition continues to fill the title field and trigger classification.
- Unknown titles remain unclassified rather than fabricating a number.
