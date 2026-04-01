import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type GeneratedGym = {
  name: string;
  address: string;
  city: string;
  region?: string;
  chainName: string;
  externalProvider: "other";
  externalId: string;
};

const gymsPath = join(process.cwd(), "prisma", "gyms-generated.json");
const generatedGyms: GeneratedGym[] = JSON.parse(readFileSync(gymsPath, "utf8"));

const CHUNK = 2500;

/** После успешного сида в базе десятки тысяч строк с externalId вида seed-… */
async function bulkGymsAlreadyLoaded(): Promise<boolean> {
  const n = await prisma.gym.count({
    where: { externalId: { startsWith: "seed-" } }
  });
  return n > 40_000;
}

async function main() {
  if (process.env.FORCE_GYM_SEED !== "1" && (await bulkGymsAlreadyLoaded())) {
    console.log(
      "Gym seed skipped: bulk catalog already in DB. Set FORCE_GYM_SEED=1 to reload from gyms-generated.json."
    );
    return;
  }

  const removed = await prisma.gym.deleteMany({ where: { externalId: null } });
  if (removed.count > 0) {
    console.log(`Removed ${removed.count} legacy gyms (no externalId) to avoid duplicates.`);
  }
  console.log(`Seeding ${generatedGyms.length} gyms from gyms-generated.json …`);
  for (let i = 0; i < generatedGyms.length; i += CHUNK) {
    const slice = generatedGyms.slice(i, i + CHUNK).map((g) => ({
      name: g.name,
      address: g.address,
      city: g.city,
      region: g.region ?? null,
      chainName: g.chainName,
      externalProvider: g.externalProvider,
      externalId: g.externalId
    }));
    const res = await prisma.gym.createMany({ data: slice, skipDuplicates: true });
    console.log(`  … ${Math.min(i + slice.length, generatedGyms.length)} / ${generatedGyms.length} (inserted ${res.count} this batch)`);
  }
  console.log("Gym seed done.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
