# Product spec (MVP): Skinulis

## 1. Goal

Create a trusted micro-contribution marketplace for personal urgent/everyday needs, optimized for tiny payments (10-100 RUB).

## 2. User roles

- Campaign owner (creates campaign, receives funds, posts report)
- Supporter (contributes small amount)
- Moderator (reactive review after reports/flags)
- Admin (risk and payment operations)

## 3. Core flows

1. Owner signs up via phone OTP
2. Owner creates campaign:
   - title
   - short story
   - target amount
   - category
   - payout details
3. Owner adds payout requisites (SBP/phone/card)
4. Owner pays placement fee (299 RUB for 14 days)
5. Campaign appears in feed
6. Supporters transfer money directly to owner requisites and confirm amount in app
7. System applies hold/risk checks for suspicious campaigns
8. Owner uploads result report

## 4. Campaign categories (MVP)

- urgent household expenses
- health and medicine support
- emergency recovery (incident/damage)
- family and social support

## 5. Abuse-prevention baseline (light model)

- no heavy manual pre-moderation
- required verified phone
- max 2 active campaigns per account
- automatic risk flags:
  - repeated payout account use
  - too many campaigns in short period
  - complaint spike
  - suspicious text patterns
- instant freeze action by moderator after validated complaints

## 6. Pricing

- base placement: 299 RUB / 14 days
- feed bump: 99 RUB
- optional future: package 3 posts / month at discount

## 7. Non-functional requirements

- mobile-first UX
- campaign card opens in < 1 second on 4G
- payment flow in max 3 user taps after amount choice
- event log for every money-related action

## 8. Metrics (north-star + operational)

- NSM: successful funded campaigns/month
- publication-to-first-donation conversion
- supporter repeat rate (30 days)
- abuse report ratio
- payout dispute ratio

