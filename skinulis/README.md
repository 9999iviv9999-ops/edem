# Skinulis (concept MVP)

Skinulis is a micro-contribution platform where people publish short-term personal fundraising goals and supporters chip in small amounts (10-100 RUB).

Core business model for launch:
- one-time payment for publication (no platform commission from collected funds)
- simple anti-abuse controls without heavy pre-moderation
- transparent campaign progress and post-factum reporting

## Why now

The behavior already exists in social feeds and chats: users publish card numbers or wallet links and ask for many small contributions.
Current flow is fragmented and low-trust. Skinulis packages that demand into a product with clear UX and minimum safety rails.

Primary trigger example:
- VK post format with direct public ask for support
- source: https://vk.com/wall-24597594_118020

## Product positioning

Not "general crowdfunding", but:
"Verified-by-flow social micro-help for urgent and everyday goals with simple posting and transparent updates."

## Launch monetization

- `299 RUB` - post placement for 14 days
- `99 RUB` - optional feed bump
- no percent commission from donations in MVP

## Guardrails (light anti-fraud, no strict pre-moderation)

- phone verification required
- max 1-2 active campaigns per account
- report button on every campaign
- automatic hold on first payout for new accounts (24-48 hours)
- keyword/rate limits and automatic risk flags

## Direct transfer model

- supporters transfer funds directly to owner requisites (SBP/phone/card)
- platform does not hold donor funds and is not a payment agent in MVP
- legal draft for this model: `docs/direct-transfer-rules.md`

## Suggested repo structure

- `docs/market-analysis.md` - analogs and market assumptions
- `docs/product-spec.md` - product concept and UX rules
- `docs/mvp-roadmap-90d.md` - milestones and KPI
- `api/openapi.yaml` - API contract draft for MVP
- `web/` - placeholder for frontend app

## MVP scope (30-45 days)

1. Auth with phone confirmation
2. Campaign creation (limited templates)
3. Placement payment flow
4. Feed + card page + quick donate buttons
5. Complaints and admin light review
6. Payout request + report upload

## Success metrics for first 90 days

- paid publications/month
- share of campaigns that reach >= 70% of target
- abuse reports per 100 campaigns
- median time from publish to first contribution
- repeat supporter rate (D30)

## Run locally

1. Install dependencies:
   - `cd skinulis`
   - `npm install`
2. Run API:
   - `npm run dev:api`
   - API URL: `http://localhost:4010`
   - copy env: `copy api\\.env.example api\\.env`
3. In another terminal run web:
   - `cd skinulis`
   - `npm run dev:web`
   - Web URL: `http://localhost:5177`
   - copy env: `copy web\\.env.example web\\.env`
4. Admin panel:
   - `http://localhost:5177/admin`
   - API headers: `x-admin-role`, `x-admin-key`
   - dev keys:
     - `moderator` -> `skinulis-dev-moderator-key`
     - `ops` -> `skinulis-dev-ops-key`
     - `superadmin` -> `skinulis-dev-superadmin-key`
   - set `MODERATOR_KEY`, `OPS_KEY`, `SUPERADMIN_KEY` in production
   - processing callback secret: `PROCESSING_CALLBACK_SECRET` (dev default: `skinulis-dev-processing-secret`)
   - quick auth check endpoint: `GET /v1/admin/auth-check` (with `x-admin-role` + `x-admin-key`)

## Subscriptions (manual processing)

- create subscription invoice: `POST /v1/subscriptions/invoice`
- check subscription status: `GET /v1/subscriptions/status?ownerPhone=...`
- processing callback: `POST /v1/payments/subscription/manual-result` (or legacy `.../placement/manual-result`) with header `x-processing-secret`
- ops admin queue (subscription invoices):
  - `GET /v1/admin/placement-payments`
  - `POST /v1/admin/placement-payments/:id/enqueue`
  - `POST /v1/admin/placement-payments/:id/complete`
- active subscriptions list: `GET /v1/admin/subscriptions`

## Production hardening included

- persistent local state in `api/data/state.json` (survives restarts)
- security middleware: `helmet` + `express-rate-limit`
- CORS allowlist via `CORS_ORIGINS`
- protected processing callback via `PROCESSING_CALLBACK_SECRET`
- startup protection: API refuses production start with default secrets
- readiness probes: `GET /health/live`, `GET /health/ready`
- feature flag: set `SUBSCRIPTIONS_ENABLED=false` for temporary free mode
- free mode limit: `FREE_ACTIVE_CAMPAIGN_LIMIT` (default `1`)

## Receipts for confirmed transfers

- each confirmed transfer can have attached receipt (jpg/png/webp/pdf)
- upload endpoint: `POST /v1/transfer-confirmations/:id/receipt` (multipart field: `receipt`)

## Deploy without domain

- step-by-step guide: `docs/DEPLOY_NO_DOMAIN.md`
- API template: `api/render.yaml`
- Web template: `web/vercel.json`

## Pre-launch checklist (MVP)

- set production API URL in web env: `VITE_API_URL=https://skinulis-api.vercel.app`
- verify admin login by role using `/admin` and API `GET /v1/admin/auth-check`
- verify feed, filters and pagination on homepage
- verify upload of one campaign video and one transfer receipt
- verify `GET /health/live` and `GET /health/ready`

