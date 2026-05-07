CREATE TABLE "ProfileComment" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfileComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProfileComment_targetUserId_createdAt_idx"
ON "ProfileComment"("targetUserId", "createdAt");

CREATE INDEX "ProfileComment_authorId_createdAt_idx"
ON "ProfileComment"("authorId", "createdAt");

ALTER TABLE "ProfileComment"
ADD CONSTRAINT "ProfileComment_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfileComment"
ADD CONSTRAINT "ProfileComment_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
