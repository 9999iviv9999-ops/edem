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

const CHUNK = 1500;

async function main() {
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
