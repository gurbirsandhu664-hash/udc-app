# Deploy V148

1. Back up the existing repository/deployment.
2. Extract the ZIP and deploy all extracted files at the project root.
3. Include subject-engine.js and vehicle-classification.js beside server.js, and preserve both JSON reference indexes.
4. Preserve existing server environment variables. Do not put secrets into browser code.
5. Build with `npm ci`; start with `npm start`.
6. Confirm the page and `/api/health` show V148.
7. Test "Repair of buses", then "Artificial intelligence in rural schools in India, 2020-2025". Select Education and classify again. Also test an opaque title with a descriptive summary.
8. Test on supported devices before wider use.

Source code and package files should return 404 when requested over HTTP. This release has not been deployed by ChatGPT to your live hosting account.
