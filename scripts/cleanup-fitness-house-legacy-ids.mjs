import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const legacyIds = [
  "fh-gatchina-knysha",
  "fh-devyatkino-glavnaya",
  "fh-kudrovo-evropeyskiy",
  "fh-lakhta-lahtinskiy",
  "fh-murino-shuvalova",
  "fh-novogorelovo-sovremennikov"
];

async function main() {
  const deleted = await prisma.gym.deleteMany({
    where: {
      chainName: { startsWith: "Fitness House" },
      externalId: { in: legacyIds }
    }
  });

  const fh = await prisma.gym.count({ where: { chainName: { startsWith: "Fitness House" } } });
  const total = await prisma.gym.count();

  console.log(`deleted=${deleted.count} fitnessHouse=${fh} total=${total}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
