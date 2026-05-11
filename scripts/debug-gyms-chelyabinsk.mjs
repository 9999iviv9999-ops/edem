import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.gym.count();
  const city = "Челябинск";
  const inCity = await prisma.gym.count({ where: { city } });
  const chl = await prisma.gym.count({ where: { externalId: { startsWith: "chl-" } } });
  const chlInCity = await prisma.gym.count({
    where: { city, externalId: { startsWith: "chl-" } }
  });
  const chains = await prisma.gym.groupBy({
    by: ["chainName"],
    where: { city },
    _count: true
  });
  console.log(JSON.stringify({ total, chelyabinsk: inCity, chlGlobal: chl, chlInChelyabinsk: chlInCity, chainsInCity: chains }, null, 2));
}

main()
  .finally(() => prisma.$disconnect());
