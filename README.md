# UDC One-Click V12 UNIVERSAL — FIXED

This release is based on the uploaded V11 project.

### V12 fix requested
The ordinary user flow no longer stops at **VERIFICATION REQUIRED**.

Flow:
1. Exact uploaded-UDC match -> exact classmark.
2. If no exact match -> semantic broad UDC fallback.
3. If no semantic subject rule matches -> general fallback 0.
4. The system never uses DDC as a substitute.

The uploaded 1961 UDC edition remains the edition authority. For example, History of China is 951 in this edition.
