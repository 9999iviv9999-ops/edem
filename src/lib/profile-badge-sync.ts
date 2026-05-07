import { prisma } from "./prisma";
import { env } from "./env";

function digitsOnly(phone: string) {
  return phone.replace(/\D+/g, "");
}

/** Если задан VIP_PROFILE_BADGE_PHONE и номер совпадает — записывает profileBadge в БД (видно всем в API). */
export async function syncProfileBadgeForPhone(phone: string, userId: string) {
  const cfgPhone = env.VIP_PROFILE_BADGE_PHONE?.trim();
  if (!cfgPhone) return;
  if (digitsOnly(phone) !== digitsOnly(cfgPhone)) return;
  const label = (env.VIP_PROFILE_BADGE_LABEL ?? "Founder Diamond").trim();
  await prisma.user.update({
    where: { id: userId },
    data: { profileBadge: label }
  });
}
