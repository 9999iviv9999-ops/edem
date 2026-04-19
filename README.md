# Vprok Platform (MVP+)

Ready-to-run fullstack platform for delayed retail purchases ("buy now, pick up later").

## Implemented

- Access + refresh token auth with session revocation
- Retailer onboarding and company verification
- Retailer product publishing (with image URL support)
- Public catalog for delayed purchases
- Order creation and delayed pickup flow
- Payment flow (mock + external-provider-ready mode)
- Dispute flow buyer <-> retailer
- Buyer anti-fraud rules + risk events logging
- Admin risk endpoints and risk summary
- Web client (React + Vite) for Vprok flows

## Stack

- Backend: Node.js + TypeScript + Express
- PostgreSQL + Prisma ORM
- Zod validation
- AWS SDK S3 client + Multer
- Frontend: React + Vite + TypeScript + Axios

## Project folders

- API: `./`
- Web (Vprok only): `./web` — прод обычно **vprok.club**
- Web (Edem — лента, профиль, залы): `./edem-web` — прод обычно **app.edem.press** (отдельный Vercel-проект, см. `edem-web/DEPLOY_VERCEL.md`)
- Geneso NFT marketplace (standalone web): `./nft-web`
- Smart contracts: `./contracts`
- Mobile (Expo shell): `./mobile`
- Vprok module docs: `./docs/VPROK.md`

## Geneso NFT quickstart (ready-to-work)

**Chain:** **Base mainnet** (chain id `8453`) only — deploy contracts there, then point `nft-web` and Vercel at those addresses. No testnet in the default path.

**Long-term context (product, deploy, mobile strategy):** see [`docs/GENESO_PROJECT_MEMORY.md`](docs/GENESO_PROJECT_MEMORY.md).

Run from repository root:

**Fast path:** `npm run geneso:bootstrap` (installs `contracts` + `nft-web`, compile, smoke test, web build). Then copy env files and run `npm run geneso:doctor` (use `npm run geneso:doctor -- --strict` in CI to fail on warnings too). Use `npm run geneso:doctor -- --deploy` or `-- --web` to check only one side.

1. Install dependencies:
   - `npm install` (API + shared tooling)
   - `npm run geneso:contracts:install`
   - `npm run geneso:web:install`
2. Configure env files:
   - `copy contracts\\.env.example contracts\\.env`
   - `copy nft-web\\.env.example nft-web\\.env`
3. Build and validate contracts:
   - `npm run geneso:contracts:compile`
   - `npm run geneso:contracts:test`
4. Deploy contracts (Base mainnet):
   - `npm run geneso:contracts:deploy:base`
5. Export ABIs to frontend:
   - `npm run geneso:contracts:export:abi`
6. Set deployed addresses in `nft-web/.env`:
   - `VITE_MARKETPLACE_ADDRESS=0x...`
   - `VITE_NFT_COLLECTION_ADDRESS=0x...`
   - optional `VITE_WALLETCONNECT_PROJECT_ID=...`
7. Run web locally:
   - `npm run geneso:web:dev`
8. Production build:
   - `npm run geneso:web:build`

## Run locally (without Docker)

1. API deps: `npm install`
2. Web deps: `cd web && npm install`
   - Optional NFT app: `cd nft-web && npm install`
3. Create env files:
   - API: `copy .env.example .env`
   - Web: `copy web\\.env.example web\\.env`
4. Start PostgreSQL and configure `DATABASE_URL` in `.env`
5. Apply schema: `npx prisma migrate dev --name init`
6. Seed data (optional): `npm run prisma:seed`
7. Start API:
   - Legacy mixed mode (Edem + Vprok): `npm run dev`
   - Vprok-only mode: `npm run dev:vprok`
8. In a second terminal run web:
   - `cd web`
   - `npm run dev`

## Run with Docker

1. Create env file: `copy .env.example .env`
2. (Optional) set `VITE_API_URL` in `web/.env` for build-time URL
3. Start services: `docker compose up -d --build`
3. Apply schema in API container:
   - `docker exec -it vprok-api npx prisma migrate dev --name init`
4. Seed data (optional):
   - `docker exec -it vprok-api npm run prisma:seed`

Services:
- Web: `http://localhost:8080`
- API: `http://localhost:3000` 
- PostgreSQL: `localhost:5432`
- pgAdmin: `http://localhost:5050`

### Dual server isolation (Edem + Vprok in parallel)

If you want hard isolation on one host (two separate API processes):

1. Start dedicated dual stack:
   - `docker compose -f docker-compose.dual.yml up -d --build`
2. Endpoints:
   - Edem mixed API: `http://localhost:3000`
   - Vprok-only API: `http://localhost:3001`
3. For web deployment, set:
   - `VITE_API_URL=https://api.vprok.club` (mapped to the Vprok-only service)

## API (short)

- Auth:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `POST /api/auth/logout-all` (auth)
- Gyms:
  - `GET /api/gyms`
  - `POST /api/gyms`
- Profile:
  - `GET /api/profiles/me` (auth)
  - `PUT /api/profiles/me` (auth)
  - `GET /api/profiles/gyms/:gymId` (auth)
- Interactions:
  - `POST /api/likes` (auth)
  - `GET /api/matches` (auth)
  - `POST /api/messages` (auth)
  - `GET /api/messages/:matchId` (auth)
  - `POST /api/blocks` (auth)
  - `DELETE /api/blocks/:blockedUserId` (auth)
  - `POST /api/reports` (auth)
- Media:
  - `POST /api/media/upload-photo` (auth, multipart field `photo`)
- Vprok (MVP prepay catalog):
  - `POST /api/vprok/companies` (auth)
  - `PATCH /api/vprok/companies/:companyId/policy` (auth)
  - `PATCH /api/vprok/admin/companies/:companyId/verify` (header `x-moderation-key`)
  - `GET /api/vprok/admin/companies` (header `x-moderation-key`)
  - `GET /api/vprok/companies/my` (auth)
  - `POST /api/vprok/companies/:companyId/products` (auth)
  - `GET /api/vprok/catalog`
  - `POST /api/vprok/orders` (auth)
  - `POST /api/vprok/orders/:orderId/pay` (auth, mock)
  - `POST /api/vprok/payments/webhook` (provider, signed)
  - `GET /api/vprok/orders/my` (auth)
  - `POST /api/vprok/orders/:orderId/refund` (auth)
  - `POST /api/vprok/orders/:orderId/disputes` (auth)
  - `GET /api/vprok/companies/:companyId/disputes` (auth)
  - `PATCH /api/vprok/disputes/:disputeId` (auth)
  - `GET /api/vprok/admin/risk-events` (header `x-moderation-key`)
  - `GET /api/vprok/admin/risk-events/summary` (header `x-moderation-key`)

Removed from runtime in `vprok-only` mode:
- `GET/POST /api/gyms`
- `/api/profiles/*`
- interaction endpoints (`/api/likes`, `/api/matches`, `/api/messages`, `/api/blocks`, `/api/reports`)
- `/api/moderation/*`

## Where and how to deploy

Recommended production placement:

1. **Database**: Railway Postgres or Neon Postgres
2. **API**: Render Web Service, Railway Service, or Fly.io app
3. **Web**: Vercel or Netlify
4. **Domain + SSL**: Cloudflare DNS

Fast deployment path:

- **API deployment (Render/Railway)**:
  - Deploy from `vprok-backend` root (this repository root)
  - Start command for isolated Vprok service: `npm run start:vprok`
  - Legacy mixed mode remains available: `npm run start`
  - Build command: `npm run prisma:generate && npm run build`
  - Set env vars from `.env.example`
  - Run migrations once: `npx prisma migrate deploy`

- **Web deployment (Vercel)**:
  - Root directory: `web`
  - Build command: `npm run build`
  - Output directory: `dist`
  - Env var: `VITE_API_URL=https://YOUR-API-DOMAIN`

- **DNS**:
  - `api.vprok.club` -> API host
  - `vprok.club` -> Web host
  - Enable HTTPS on both
