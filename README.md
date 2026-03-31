# Edem Fullstack (MVP+)

Ready-to-run fullstack dating app focused on fitness centers in Russia.

## Implemented

- Access + refresh token auth with session revocation
- Profile setup with:
  - main gym + extra gyms
  - goals, training time slots, training types
  - photo URLs and personal description
- Gym directory with support for external map IDs (Yandex/2GIS)
- Gym-based profile feed with filters
- Likes, mutual match creation, and chat
- Block and report system
- Moderation endpoints (review reports, ban/unban users)
- Photo upload to S3-compatible storage (including Cloudflare R2)
- Web client (React + Vite) with polished UI:
  - login/register
  - profile setup
  - gym feed and likes
  - matches and chat

## Stack

- Backend: Node.js + TypeScript + Express
- PostgreSQL + Prisma ORM
- Zod validation
- AWS SDK S3 client + Multer
- Frontend: React + Vite + TypeScript + Axios

## Project folders

- API: `./`
- Web: `./web`

## Run locally (without Docker)

1. API deps: `npm install`
2. Web deps: `cd web && npm install`
3. Create env files:
   - API: `copy .env.example .env`
   - Web: `copy web\\.env.example web\\.env`
4. Start PostgreSQL and configure `DATABASE_URL` in `.env`
5. Apply schema: `npx prisma migrate dev --name init`
6. Seed gyms: `npm run prisma:seed`
7. Start API: `npm run dev`
8. In a second terminal run web:
   - `cd web`
   - `npm run dev`

## Run with Docker

1. Create env file: `copy .env.example .env`
2. (Optional) set `VITE_API_URL` in `web/.env` for build-time URL
3. Start services: `docker compose up -d --build`
3. Apply schema in API container:
   - `docker exec -it edem-api npx prisma migrate dev --name init`
4. Seed gyms:
   - `docker exec -it edem-api npm run prisma:seed`

Services:
- Web: `http://localhost:8080`
- API: `http://localhost:3000` 
- PostgreSQL: `localhost:5432`
- pgAdmin: `http://localhost:5050`

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
- Moderation:
  - `GET /api/moderation/reports` (header `x-moderation-key`)
  - `PATCH /api/moderation/reports/:reportId`
  - `PATCH /api/moderation/users/:userId/ban`

## Where and how to deploy

Recommended production placement:

1. **Database**: Railway Postgres or Neon Postgres
2. **API**: Render Web Service, Railway Service, or Fly.io app
3. **Web**: Vercel or Netlify
4. **Domain + SSL**: Cloudflare DNS

Fast deployment path:

- **API deployment (Render/Railway)**:
  - Deploy from `edem-backend` root
  - Start command: `npm run start`
  - Build command: `npm run prisma:generate && npm run build`
  - Set env vars from `.env.example`
  - Run migrations once: `npx prisma migrate deploy`

- **Web deployment (Vercel)**:
  - Root directory: `web`
  - Build command: `npm run build`
  - Output directory: `dist`
  - Env var: `VITE_API_URL=https://YOUR-API-DOMAIN`

- **DNS**:
  - `api.edem.ru` -> API host
  - `app.edem.ru` -> Web host
  - Enable HTTPS on both
