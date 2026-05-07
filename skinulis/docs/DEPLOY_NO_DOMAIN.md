# Deploy without custom domain

This guide deploys Skinulis on temporary provider URLs:
- API on Render
- Web on Vercel

## 1) Prepare production env values

Generate strong secrets (32+ chars) for:
- `MODERATOR_KEY`
- `OPS_KEY`
- `SUPERADMIN_KEY`
- `PROCESSING_CALLBACK_SECRET`

## 2) Deploy API to Render

1. Push repository to GitHub.
2. In Render create a new Web Service from repo.
3. Use `skinulis/api/render.yaml` values:
   - Root directory: `skinulis/api`
   - Build command: `npm install && npm run build`
   - Start command: `npm run start`
4. Set env vars:
   - `NODE_ENV=production`
   - `PORT=4010`
   - `CORS_ORIGINS=https://<your-vercel-app>.vercel.app`
   - `RATE_LIMIT_WINDOW_MS=900000`
   - `RATE_LIMIT_MAX=400`
   - `MODERATOR_KEY=<...>`
   - `OPS_KEY=<...>`
   - `SUPERADMIN_KEY=<...>`
   - `PROCESSING_CALLBACK_SECRET=<...>`
5. Deploy and verify:
   - `GET https://<render-app>/health/live`
   - `GET https://<render-app>/health/ready`

## 3) Deploy Web to Vercel

1. Import repo in Vercel.
2. Set root directory to `skinulis`.
3. Build command:
   - `npm run build --workspace web`
4. Output directory:
   - `web/dist`
5. Set env var:
   - `VITE_API_URL=https://<render-app>`
6. Deploy and open:
   - `https://<vercel-app>.vercel.app`
   - `https://<vercel-app>.vercel.app/admin`

## 4) Smoke checklist

1. Open web and check no CORS errors.
2. In user page:
   - create subscription invoice
   - confirm status remains pending
3. In `/admin` as `ops`:
   - open invoice queue
   - set invoice to processing
   - complete as paid
4. In user page:
   - refresh subscription status
   - confirm active subscription appears
5. Create campaign and confirm it appears in feed.
6. Confirm transfer, upload receipt, verify receipt link opens.

## 5) Operations notes

- API state persists in `api/data/state.json` on service disk.
- On Render free/restart scenarios disk can reset; for long-term production switch to PostgreSQL + object storage.

