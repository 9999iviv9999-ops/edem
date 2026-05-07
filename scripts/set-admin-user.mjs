#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const preferred = await prisma.user.findFirst({
    where: { email: { not: { endsWith: "@example.com" } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true }
  });
  const fallback = await prisma.user.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true }
  });
  const target = preferred || fallback;
  if (!target) {
    console.log("NO_USERS");
    return;
  }
  await prisma.user.update({
    where: { id: target.id },
    data: { isAdmin: true }
  });
  console.log(`ADMIN_SET ${target.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
