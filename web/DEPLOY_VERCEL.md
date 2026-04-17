# Vercel — Vprok web (`web/`)

This project is the **Vprok web app**. NFT marketplace lives in `nft-web/` as a separate Vercel project.

## Build settings

- Framework: `Vite`
- Root directory: `web`
- Build: `npm run build`
- Output: `dist`

## Environment

- `VITE_API_URL` (recommended) — e.g. `https://api.vprok.club`

## SPA

`vercel.json` includes SPA rewrites for client-side routing.
Set `VITE_API_URL` to your Vprok backend domain to avoid any cross-project coupling.
