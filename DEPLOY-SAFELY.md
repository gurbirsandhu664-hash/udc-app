# Deploy V134 safely from iPhone

1. In GitHub, open the `udc-app` repository and download the current repository ZIP as a backup.
2. Save the V134 ZIP from ChatGPT to Files and extract it.
3. Do not use GitHub “Upload file” to upload the ZIP as a single file. The repository needs the extracted project files at its root.
4. Replace the existing matching files only after confirming the backup is saved. Preserve `ddc-23-reference-index.json` and `udc-1961-reference-index.json`.
5. Commit changes to `main`; Render should deploy automatically if auto-deploy is enabled.
6. In Render, wait for a successful deploy and check `/api/health`.
7. Test at least 10 unrelated titles. Treat any broad/candidate status as unverified until checked against the proper schedule.

Never delete the existing index, change the database URL, or rotate secrets as part of this code-only update unless there is a separate confirmed need.
