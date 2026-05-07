ALTER TABLE "ProfileComment"
ADD COLUMN IF NOT EXISTS "photoIndex" INTEGER;

CREATE INDEX IF NOT EXISTS "ProfileComment_targetUserId_photoIndex_createdAt_idx"
ON "ProfileComment"("targetUserId", "photoIndex", "createdAt");
