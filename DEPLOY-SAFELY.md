# Deploy V146

1. Back up the existing deployment/repository.
2. Extract this ZIP and put its files at the project root.
3. Preserve existing server environment variables. Never put keys into index.html.
4. Build with `npm ci`; start with `npm start`.
5. Check `/api/health`, run `npm test`, then test classification on your deployed URL.
6. Test mobile title entry, error handling and voice entry on the devices you support.

The root directory must contain server.js, index.html, package.json, package-lock.json and both bundled JSON indexes. Requests for internal source files should return 404.
