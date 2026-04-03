-- AlterTable
ALTER TABLE "User" ADD COLUMN "okrug" TEXT;

-- AlterTable
ALTER TABLE "Gym" ADD COLUMN "okrug" TEXT;

-- CreateIndex
CREATE INDEX "Gym_city_okrug_district_idx" ON "Gym"("city", "okrug", "district");
