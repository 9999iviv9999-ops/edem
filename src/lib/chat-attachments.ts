import { env } from "./env";

/** Проверка, что URL вложения принадлежит текущему пользователю (после upload на сервер). */
export function isAllowedMessageAttachmentUrl(userId: string, url: string): boolean {
  const u = (url || "").trim();
  if (!u || u.includes("..")) return false;

  const localPrefix = `/uploads/users/${userId}/`;
  if (u.startsWith(localPrefix)) {
    return /^\/uploads\/users\/[^/]+\/.+$/i.test(u.split("?")[0] || "");
  }

  const base = (env.S3_PUBLIC_URL_BASE || "").replace(/\/$/, "");
  if (base && u.startsWith(base)) {
    try {
      const path = new URL(u).pathname;
      return path.includes(`/users/${userId}/`);
    } catch {
      return false;
    }
  }

  return false;
}
