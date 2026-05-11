#!/usr/bin/env node
/**
 * Удаляет пользователей, созданные scripts/smoke-api.mjs (до отключения регистрации в смоуке).
 *
 * Критерии (не трогаем isAdmin):
 * - имя ровно "Smoke Test User", или
 * - email вида smoke-<числа>@example.com
 *
 *   node scripts/cleanup-smoke-users.mjs           # удалить
 *   DRY_RUN=1 node scripts/cleanup-smoke-users.mjs # только показать
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run");
const smokeEmail = /^smoke-\d+@example\.com$/i;

async function main() {
  const candidates = await prisma.user.findMany({
    where: {
      isAdmin: false,
      OR: [
        { name: "Smoke Test User" },
        {
          AND: [{ email: { startsWith: "smoke-" } }, { email: { endsWith: "@example.com" } }]
        }
      ]
    },
    select: { id: true, email: true, name: true, phone: true, createdAt: true }
  });

  const toDelete = candidates.filter((u) => u.name === "Smoke Test User" || smokeEmail.test(u.email));

  console.log(`[cleanup-smoke-users] matched ${toDelete.length} user(s)${dryRun ? " (dry run)" : ""}`);
  for (const u of toDelete) {
    console.log(`  - ${u.id} ${u.email} ${u.phone} ${u.createdAt.toISOString()}`);
  }

  if (dryRun || toDelete.length === 0) {
    return;
  }

  const ids = toDelete.map((u) => u.id);
  const result = await prisma.user.deleteMany({
    where: { id: { in: ids }, isAdmin: false }
  });
  console.log(`[cleanup-smoke-users] deleted ${result.count} row(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
