# Deploy V149

1. Back up the existing project.
2. Extract the ZIP and deploy its files at the project root. Upload the files, not the ZIP as a single file.
3. New required server modules: medical-classification.js, provider-policy.js and result-quality.js. Keep subject-engine.js and vehicle-classification.js too.
4. Preserve both reference JSON files, package.json and package-lock.json.
5. Build: `npm ci`. Start: `npm start`. Use Node.js 22 or newer.
6. Confirm the page and `/api/health` both show V149.
7. Test "Heart Cancer in Dogs". Expect the veterinary/heart/cancer breakdown, UDC candidate 619:616.12-006.6:636.7 and DDC candidate 636.7089699412.
8. Test "Repair of buses", a title requiring main-subject selection and an opaque title with a summary. Test on supported devices.

The tests folder is needed for `npm test`, but not for `npm start`. Keep its contents together if uploading it. Test fixtures contain no real API keys.

Optional provider credentials belong in server environment variables. They are not required for the finite local rules. A configured key does not establish authority verification of model output.

This ZIP has not been deployed to your live hosting account by ChatGPT.
