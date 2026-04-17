-- AlterTable
ALTER TABLE "VprokOrder" ADD COLUMN "platformFeeBps" INTEGER NOT NULL DEFAULT 300;
ALTER TABLE "VprokOrder" ADD COLUMN "platformFeeCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VprokOrder" ADD COLUMN "retailerPayoutCents" INTEGER NOT NULL DEFAULT 0;

-- Backfill legacy rows (3% of gross, same rounding as application code)
UPDATE "VprokOrder"
SET
  "platformFeeBps" = 300,
  "platformFeeCents" = ROUND("totalCents" * 300 / 10000.0),
  "retailerPayoutCents" = "totalCents" - ROUND("totalCents" * 300 / 10000.0);
