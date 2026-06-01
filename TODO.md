# TODO — Vercel serverless crash fixes

- [ ] Inspect Vercel routing + entrypoint correctness
- [x] Remove server startup (`app.listen`) from serverless path

- [x] Refactor Mongo connection to be serverless-safe (connect once, require MONGO_URI)

- [x] Replace multer `diskStorage` with `memoryStorage` (videos + studio)

- [x] Add/strengthen async + error handling (multer errors + jwt misconfig)

- [x] Update `vercel.json` to use `@vercel/node` with correct routing to `api/index.js`

- [x] Add debug console logs for Vercel logs (request traces, config presence)

- [x] Verify required env vars are used correctly (MONGO_URI, JWT_SECRET, GOOGLE_CLIENT_ID)

- [ ] Provide deployment instructions
- [x] Final test plan for Vercel (health, auth, upload)


