# Vprok module (MVP)

`Vprok` is a prepayment module for delayed pickup of long shelf-life products.

## What is implemented

- Platform fee (default 3%) stored per order: `platformFeeCents`, `retailerPayoutCents`, configurable via `VPROK_PLATFORM_FEE_BPS`
- Public `GET /settings/public` for fee disclosure in UI
- Company onboarding from user account
- Seller-owned policy model (marketplace is infrastructure layer)
- Seller verification endpoint for moderation
- Company-side product publishing
- Public catalog endpoint
- Customer order creation
- Mock online payment confirmation
- Provider webhook payment processing with signature and idempotency
- Customer order list
- Customer refund action (MVP flow)
- Dispute ticket flow (buyer -> seller)

## Data model

New Prisma entities:

- `Company`
- `CompanyMember`
- `VprokProduct`
- `VprokOrder` (includes `platformFeeBps`, `platformFeeCents`, `retailerPayoutCents` for split settlement)
- `VprokOrderItem`
- `VprokPayment`
- `VprokPaymentEvent`
- `VprokDispute`
- `VprokTermsAcceptance`

Also added seller policy fields:

- `Company.disputeEmail`
- `Company.termsUrl`
- `Company.returnPolicyText`
- `Company.legalName`
- `VprokOrder.sellerTermsSnapshot`

## Quick start

1. Install dependencies:
   - `npm install`
2. Apply database changes:
   - `npx prisma migrate dev --name add-vprok-module`
3. Start API:
   - `npm run dev`

## API

Base path: `/api/vprok`

### 1) Create company (auth)

`POST /companies`

```json
{
  "name": "Lenta Market",
  "slug": "lenta-market",
  "description": "Products available for delayed pickup",
  "legalName": "OOO Lenta Market",
  "disputeEmail": "claims@lenta-market.example",
  "termsUrl": "https://lenta-market.example/vprok-terms",
  "returnPolicyText": "If exact SKU is unavailable, seller provides equivalent item or full refund."
}
```

The creator becomes `owner`.

### 1.1) Update seller policy (auth, company member)

`PATCH /companies/:companyId/policy`

```json
{
  "disputeEmail": "support@retailer.example",
  "termsUrl": "https://retailer.example/vprok-terms",
  "returnPolicyText": "Disputes are handled directly by seller support."
}
```

### 1.2) Verify seller company (moderation key)

`PATCH /admin/companies/:companyId/verify`

Headers:

- `x-moderation-key: <ADMIN_MODERATION_KEY>`

```json
{
  "isVerified": true
}
```

### 2) List my companies (auth)

`GET /companies/my`

### 3) Create product for company (auth, company member)

`POST /companies/:companyId/products`

```json
{
  "title": "Sugar 1kg",
  "imageUrl": "https://cdn.example.com/products/sugar-1kg.jpg",
  "description": "Granulated sugar",
  "unit": "kg",
  "sku": "SUGAR-001",
  "priceCents": 9900,
  "minShelfLifeDays": 365,
  "substitutionPolicy": "Equivalent sugar with same weight and grade",
  "isActive": true
}
```

### 4) Public catalog

`GET /catalog?companyId=<id>&q=sugar&limit=20`

### 4.1) Public settings (no auth)

`GET /settings/public`

Returns commission config for UI (from `VPROK_PLATFORM_FEE_BPS`, default `300` = 3%):

```json
{ "platformFeeBps": 300, "platformFeePercent": 3 }
```

### Settlement (split)

On order creation the API stores:

- `totalCents` — gross amount the buyer pays
- `platformFeeCents` — platform commission (`round(totalCents * bps / 10000)`)
- `retailerPayoutCents` — `totalCents - platformFeeCents` (intended net to retailer after acquirer split)

Mock pay and external `/pay` responses include a `settlement` object for dashboards. Integrate a real acquirer’s **split / marketplace** API using these amounts.

### 5) Create order (auth)

`POST /orders`

```json
{
  "companyId": "cmp_123",
  "pickupDeadline": "2027-04-01T00:00:00.000Z",
  "acceptSellerTerms": true,
  "acceptPlatformTerms": true,
  "platformTermsVersion": "v1",
  "sellerTermsVersion": "v1",
  "items": [
    { "productId": "prd_1", "quantity": 2 },
    { "productId": "prd_2", "quantity": 1 }
  ]
}
```

Order creation validates that seller policy is complete (`disputeEmail` and at least one of `termsUrl` or `returnPolicyText`) and snapshots these terms into `sellerTermsSnapshot`.
Platform and seller terms acceptance are logged in `VprokTermsAcceptance`.

### 6) Pay order (auth, mock)

`POST /orders/:orderId/pay`

```json
{
  "provider": "mock",
  "providerPaymentId": "payment-001"
}
```

Current MVP behavior:

- Order status changes from `pending_payment` to `paid`
- `VprokPayment` row is created with status `succeeded`

If `VPROK_PAYMENT_PROVIDER` is not `mock`, `/pay` creates `pending` payment and expects provider webhook to finalize status.

### 6.1) Provider webhook (server-to-server)

`POST /payments/webhook`

Headers:

- `x-vprok-signature: <hex hmac sha256 over JSON body>`

Signature pseudo:

`hex(hmac_sha256(VPROK_WEBHOOK_SECRET, JSON.stringify(body)))`

Body example:

```json
{
  "eventId": "evt_0001",
  "provider": "cloudpayments",
  "orderId": "ord_123",
  "providerPaymentId": "pay_789",
  "status": "succeeded",
  "amountCents": 9900
}
```

Webhook behavior:

- verifies signature
- ensures idempotency by `eventId`
- rejects if `amountCents` does not match the order’s `totalCents`
- updates `VprokPayment` status
- updates order status (`paid`/`refunded`)
- stores raw event in `VprokPaymentEvent`

### 7) List my orders (auth)

`GET /orders/my`

### 8) Refund paid order (auth)

`POST /orders/:orderId/refund`

Current MVP behavior:

- Only `paid` orders can be refunded
- Order status changes to `refunded`
- Refund payment row is written with status `refunded`

### 9) Buyer opens dispute (auth)

`POST /orders/:orderId/disputes`

```json
{
  "buyerMessage": "Seller did not provide exact SKU and equivalent was not acceptable."
}
```

### 10) Seller list disputes (auth, company member)

`GET /companies/:companyId/disputes`

### 11) Seller updates dispute status (auth, company member)

`PATCH /disputes/:disputeId`

```json
{
  "status": "resolved",
  "sellerResponse": "Full refund initiated.",
  "resolutionNote": "Resolved directly by seller support."
}
```

## Current constraints

- Payment integration is mocked; no external acquirer yet.
- Company verification uses endpoint + moderation key; dedicated moderation UI is not yet implemented.
- No admin moderation panel for products yet.
- No automatic substitution flow yet (only data field on product).

## Buyer anti-fraud (backend-enforced)

Current API includes server-side limits for new buyer accounts:

- max order amount: `50_000` cents
- max daily amount (24h): `120_000` cents
- max paid orders per 24h: `3`
- cooldown between payments: `30` seconds

On violation, API returns `429` with reason code, for example:

- `RISK_ORDER_LIMIT_EXCEEDED`
- `RISK_DAILY_COUNT_LIMIT`
- `RISK_DAILY_SUM_LIMIT`
- `RISK_PAYMENT_COOLDOWN`

Risk events are logged in `VprokRiskEvent`.

Admin monitoring endpoint:

- `GET /api/vprok/admin/risk-events` (header `x-moderation-key`)
- `GET /api/vprok/admin/risk-events/summary?days=7&top=10` (header `x-moderation-key`)
- `GET /api/vprok/admin/companies` (header `x-moderation-key`)

## Responsibility model (marketplace approach)

- Platform acts as infrastructure and transaction orchestration layer.
- Seller defines:
  - product list,
  - substitution policy,
  - return policy,
  - dispute contact channel.
- Customer accepts seller terms at order creation (`acceptSellerTerms: true`).
- Seller terms are snapshotted in order to prevent retroactive policy edits.

Important: legal compliance may still require shared obligations by marketplace under local consumer law; this must be validated by legal counsel before production launch.

## Recommended next step

Integrate one payment gateway webhook flow (`paid/failed/refund`) and store external transaction status transitions in `VprokPayment`.
