#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.user.updateMany({
    where: { banReason: { startsWith: "[AUTO]" } },
    data: { isBanned: false, banReason: null }
  });
  const remaining = await prisma.user.count({
    where: { banReason: { startsWith: "[AUTO]" } }
  });
  console.log(`[unban-auto] updated=${updated.count} remaining=${remaining}`);
}

main()
  .catch((err) => {
    console.error(`[unban-auto] fail: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

