#!/usr/bin/env node
/**
 * Проверка, есть ли пользователь в той БД, на которую указывает DATABASE_URL (.env).
 * Не выводит hash пароля.
 *
 *   node scripts/lookup-user.mjs petroff8010@gmail.com
 *   node scripts/lookup-user.mjs +79124740987
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

function normalizePhone(input) {
  let digits = String(input).trim().replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (digits.length === 10 && digits.startsWith("9")) digits = "7" + digits;
  return `+${digits}`;
}

const raw = process.argv[2];
if (!raw) {
  console.error("Usage: node scripts/lookup-user.mjs <email-or-phone>");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  let user = null;
  if (raw.includes("@")) {
    const email = raw.trim().toLowerCase();
    user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: {
        id: true,
        email: true,
        phone: true,
        isBanned: true,
        banReason: true,
        createdAt: true,
        passwordHash: true
      }
    });
  } else {
    const phone = normalizePhone(raw);
    const noPlus = phone.replace(/^\+/, "");
    user = await prisma.user.findFirst({
      where: { OR: [{ phone }, { phone: noPlus }] },
      select: {
        id: true,
        email: true,
        phone: true,
        isBanned: true,
        banReason: true,
        createdAt: true,
        passwordHash: true
      }
    });
  }

  if (!user) {
    console.log(JSON.stringify({ found: false, hint: "Нет записи в этой базе — часто API смотрит в другую БД или пустой инстанс." }, null, 2));
    return;
  }

  const hasPassword = Boolean(user.passwordHash && user.passwordHash.length > 10);
  console.log(
    JSON.stringify(
      {
        found: true,
        id: user.id,
        email: user.email,
        phone: user.phone,
        isBanned: user.isBanned,
        banReason: user.banReason,
        createdAt: user.createdAt,
        hasPasswordHash: hasPassword,
        socialOnlyHint: user.phone?.startsWith("social-") ? "Телефон-заглушка соц.входа; пароль мог не задаваться." : undefined
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
