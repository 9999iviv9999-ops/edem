-- Add trainer-mode fields to user profile.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isTrainer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trainerHeadline" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trainerBio" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trainerExperienceYears" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trainerSpecializations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trainerFormats" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trainerPriceFrom" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trainerContacts" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trainerVisible" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "User_isTrainer_trainerVisible_city_idx"
  ON "User"("isTrainer", "trainerVisible", "city");
CREATE INDEX IF NOT EXISTS "User_trainerVisible_updatedAt_idx"
  ON "User"("trainerVisible", "updatedAt");
