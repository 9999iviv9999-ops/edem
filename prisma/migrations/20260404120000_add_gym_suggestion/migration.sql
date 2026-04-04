-- CreateTable
CREATE TABLE "GymSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "okrug" TEXT,
    "district" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GymSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GymSuggestion_userId_createdAt_idx" ON "GymSuggestion"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GymSuggestion_city_createdAt_idx" ON "GymSuggestion"("city", "createdAt");

-- CreateIndex
CREATE INDEX "GymSuggestion_status_createdAt_idx" ON "GymSuggestion"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "GymSuggestion" ADD CONSTRAINT "GymSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
