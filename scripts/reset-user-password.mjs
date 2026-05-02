#!/usr/bin/env node
/**
 * Сброс пароля пользователя (только на доверенном сервере).
 *
 *   node scripts/reset-user-password.mjs petroff8010@gmail.com 'NewLongPass123'
 *   node scripts/reset-user-password.mjs +79124740987 'NewLongPass123'
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

function normalizePhone(input) {
  let digits = String(input).trim().replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (digits.length === 10 && digits.startsWith("9")) digits = "7" + digits;
  return `+${digits}`;
}

const raw = process.argv[2];
const newPassword = process.argv[3];
if (!raw || !newPassword || newPassword.length < 6) {
  console.error("Usage: node scripts/reset-user-password.mjs <email-or-phone> '<new-password-min-6>'");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  let user = null;
  if (raw.includes("@")) {
    const email = raw.trim().toLowerCase();
    user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true, phone: true }
    });
  } else {
    const phone = normalizePhone(raw);
    const noPlus = phone.replace(/^\+/, "");
    user = await prisma.user.findFirst({
      where: { OR: [{ phone }, { phone: noPlus }] },
      select: { id: true, email: true, phone: true }
    });
  }

  if (!user) {
    console.error("USER_NOT_FOUND");
    process.exit(2);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash }
  });
  console.log(`OK password updated for ${user.email} (${user.phone})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
