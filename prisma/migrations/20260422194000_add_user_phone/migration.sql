-- Add required phone field for auth flows.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- Backfill existing users with deterministic unique placeholder values.
UPDATE "User"
SET "phone" = 'migr-' || "id"
WHERE "phone" IS NULL;

-- Enforce non-null for Prisma model parity.
ALTER TABLE "User" ALTER COLUMN "phone" SET NOT NULL;

-- Ensure unique phone values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'User_phone_key'
  ) THEN
    CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
  END IF;
END
$$;
