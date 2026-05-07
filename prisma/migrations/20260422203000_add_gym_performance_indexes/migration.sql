-- Performance indexes for gym catalog queries.
CREATE INDEX IF NOT EXISTS "Gym_chainName_idx" ON "Gym"("chainName");
CREATE INDEX IF NOT EXISTS "Gym_city_chainName_idx" ON "Gym"("city", "chainName");
CREATE INDEX IF NOT EXISTS "Gym_city_name_idx" ON "Gym"("city", "name");
