# Skinulis API skeleton

This folder contains the contract-first draft of MVP backend.

## First implementation slices

1. `POST /v1/auth/phone/start`
2. `POST /v1/auth/phone/verify`
3. `POST /v1/campaigns`
4. `POST /v1/campaigns/{id}/publish-payment`
5. `POST /v1/campaigns/{id}/donations`
6. `POST /v1/campaigns/{id}/complaints`
7. `POST /v1/payouts/request`

## Core entities to add in DB

- users
- phone_verifications
- campaigns
- campaign_status_history
- donations
- placement_payments
- complaints
- payouts
- risk_flags

## Policy defaults

- max active campaigns per user: `2`
- default placement period: `14 days`
- base placement amount: `299 RUB`
- new user payout hold: `24-48h`

