# Vercel — Vprok web (`web/`)

This project is the **Vprok web app** only (all routes, including `/vprok-preview`, are Vprok). The Geneso NFT UI lives in `nft-web/` as **another** Vercel project.

## Domains (important)

- **vprok.club** → this project (`web/` root) — верно.
- **app.edem.press** → отдельный Vercel-проект с root **`edem-web/`** (см. [`edem-web/DEPLOY_VERCEL.md`](../edem-web/DEPLOY_VERCEL.md)). Убери `app.edem.press` с этого Vprok-проекта, иначе на Edem-домене будет Vprok.

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
