# Vprok Launch Checklist (30 days)

This checklist is for production-readiness of `Vprok` marketplace model.

## P0 (Days 1-10): Must-have before real launch

### Legal
- [ ] Buyer offer with explicit 3% non-refundable platform fee.
- [ ] Retailer agreement with liability and dispute SLA.
- [ ] Public policy pages for returns, substitutions, dispute routing.
- [ ] Terms versioning + acceptance logs (user id, ip, timestamp, version).

### Payments
- [ ] Real payment provider integration (not mock).
- [ ] Idempotent webhook handling.
- [ ] Reconciliation job (provider status vs internal order/payment status).
- [ ] Alerting for webhook failures and delayed payment events.

### Retailer onboarding
- [ ] KYC-lite verification (legal entity fields + checks).
- [ ] Retailer statuses: `pending`, `active`, `restricted`.
- [ ] Block product publishing for unverified retailers.
- [ ] Mandatory policy wizard completion for retailer.

### Disputes
- [ ] Buyer -> seller dispute flow enabled in production.
- [ ] Seller response SLA timer (e.g., 48h first response).
- [ ] Escalation path if SLA breached.
- [ ] Full audit trail for dispute actions.

## P1 (Days 11-20): Risk and operational stability

### Buyer anti-fraud
- [ ] New-account limits: order amount/day amount/orders per day.
- [ ] Device + IP correlation (risk score input).
- [ ] Cooldown between paid orders.
- [ ] Manual review queue for high-risk attempts.

### Abuse controls
- [ ] Refund abuse rules and thresholds.
- [ ] Repeated dispute abuse scoring.
- [ ] Temporary/permanent restriction framework.

### Monitoring
- [ ] Dashboard: conversion, refund rate, dispute rate, fulfillment rate.
- [ ] Top risk buyers / top risk retailers report.
- [ ] Incident runbook for payment and dispute failures.

## P2 (Days 21-30): Trust and scale

### Trust UX
- [ ] Clear pre-payment text about 3% non-refundable platform fee.
- [ ] Retailer profile transparency (SLA, fulfillment stats).
- [ ] Pickup reminders (30/14/7/1 days).

### Economics
- [ ] Unit-economics report by cohort and by SKU category.
- [ ] Commission adequacy review with fraud/chargeback costs.
- [ ] Controlled rollout to additional retailers.

## Owners and KPIs

- Product owner: conversion, activation, retention.
- Legal owner: enforceable terms and liabilities.
- Risk owner: fraud loss ratio, false positives.
- Ops owner: SLA compliance, resolution time.
- Engineering owner: payment reliability, webhook success rate.

Suggested launch gate KPIs:
- webhook success >= 99.5%
- dispute first response SLA >= 95%
- fraud loss ratio under agreed threshold
- critical incidents unresolved > 24h = 0
