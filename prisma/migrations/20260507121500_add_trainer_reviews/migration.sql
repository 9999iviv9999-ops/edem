CREATE TABLE IF NOT EXISTS "TrainerReview" (
  "id" TEXT NOT NULL,
  "trainerUserId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "specialization" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainerReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TrainerReview_trainerUserId_authorUserId_specialization_key"
  ON "TrainerReview"("trainerUserId", "authorUserId", "specialization");
CREATE INDEX IF NOT EXISTS "TrainerReview_trainerUserId_specialization_createdAt_idx"
  ON "TrainerReview"("trainerUserId", "specialization", "createdAt");
CREATE INDEX IF NOT EXISTS "TrainerReview_authorUserId_createdAt_idx"
  ON "TrainerReview"("authorUserId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TrainerReview_trainerUserId_fkey'
  ) THEN
    ALTER TABLE "TrainerReview"
      ADD CONSTRAINT "TrainerReview_trainerUserId_fkey"
      FOREIGN KEY ("trainerUserId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TrainerReview_authorUserId_fkey'
  ) THEN
    ALTER TABLE "TrainerReview"
      ADD CONSTRAINT "TrainerReview_authorUserId_fkey"
      FOREIGN KEY ("authorUserId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
