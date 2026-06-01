# Vercel deployment (Express + Mongoose + Multer memory uploads)

## 1) Correct folder structure (required)
Your repo should contain:
```
project/
 ├── api/
 │    └── index.js
 ├── package.json
 ├── vercel.json
```
In this project, the serverless entrypoint is:
- `api/index.js` (exports the Express app)

## 2) Ensure Vercel uses @vercel/node
`vercel.json` in the repo root should include `@vercel/node` builds and route requests to `/api/index.js`.

## 3) Environment variables (Vercel → Settings → Environment Variables)
Set these in **Vercel** (do NOT rely on local `.env`):
- `MONGO_URI` *(required)*: MongoDB connection string (Atlas recommended)
- `JWT_SECRET` *(required for auth)*: long random secret
- `GOOGLE_CLIENT_ID` *(required for Google Sign-In)*: OAuth client id

Optional (only if you use it):
- `ADMIN_EMAIL`

## 4) Install dependencies
- Root `package.json` is used by Vercel.
- Confirm your backend dependencies live in the root `package.json` (this project already lists them).

## 5) Upload behavior on serverless
This project now uses `multer.memoryStorage()` (no disk writes).
- Current API handlers store only **metadata** in MongoDB.
- Video/thumbnails are not persisted to the filesystem on Vercel.
- To serve actual uploaded files, integrate cloud/object storage (S3/R2/etc.) and save URLs to Mongo.

## 6) Deploy
- Push to GitHub
- Import repo to Vercel
- Ensure “Build Command” is empty or appropriate; Vercel will use its default Node builder since `@vercel/node` is configured.

## 7) Debugging
In Vercel logs you should see lines like:
- `[REQ] POST /api/...`
- `[CONFIG] MONGO_URI present: true`
- `[CONFIG] JWT_SECRET present: true`

If you get 503:
- `MONGO_URI is not configured` means set `MONGO_URI`.
- `JWT not configured` means set `JWT_SECRET`.

## 8) Suggested Vercel tests
1. `GET /api/health` should return `{ status: 'OK', mongodb: ... }`.
2. `POST /api/auth/register` should return a JWT.
3. Upload endpoints should respond with 201/400 instead of crashing.

