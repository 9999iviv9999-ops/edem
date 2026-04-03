ALTER TABLE "User"
ADD COLUMN "district" TEXT;

ALTER TABLE "Gym"
ADD COLUMN "district" TEXT;

CREATE INDEX "Gym_city_district_idx" ON "Gym"("city", "district");
