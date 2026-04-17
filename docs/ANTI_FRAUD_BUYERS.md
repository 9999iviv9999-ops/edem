# Buyer Anti-Fraud (Vprok)

This document defines anti-abuse controls for buyers.

## Goals
- Reduce payment abuse and refund abuse.
- Detect suspicious behavior early.
- Keep false positives low with explainable rules.

## Baseline controls

### Identity and account hygiene
- Require verified email and phone before first order.
- Restrict multi-account patterns (same phone/card/device).
- Apply stricter limits for new accounts (first 7-14 days).

### Transaction limits
- Max order amount for new account.
- Max daily amount for new account.
- Max paid orders per 24h for new account.
- Cooldown between paid orders to limit scripted abuse.

### Behavior scoring
- Risk score inputs:
  - account age,
  - velocity,
  - repeated failed/aborted attempts,
  - refund/dispute history,
  - device/ip anomaly.
- Route high-risk attempts to manual review or temporary hold.

### Abuse handling
- Progressive enforcement:
  1. warning,
  2. temporary limits,
  3. temporary lock,
  4. permanent ban.
- Always log reason code and evidence for each restriction.

## Minimum production implementation
- Rule engine with deterministic reason codes.
- Risk events table with timestamps and metadata.
- Admin dashboard for flagged buyers.
- Appeal/unlock workflow for support team.

## Suggested default thresholds (example)
- New account max order: 50,000 cents.
- New account max daily total: 120,000 cents.
- New account max paid orders/day: 3.
- Cooldown between paid orders: 30 seconds.

Thresholds must be tuned by live data and business context.

## UX requirements
- Show user-friendly error when blocked by risk rule.
- Do not expose internal risk model details.
- Keep messaging consistent with terms and support process.
