import { appConfig } from "../config";

export function normalizePhotoUrl(input?: string | null): string {
  const raw = (input || "").trim();
  if (!raw) return "";

  if (raw.startsWith("blob:") || raw.startsWith("data:")) return raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (parsed.pathname.startsWith("/uploads/")) {
        return `${appConfig.apiUrl}${parsed.pathname}`;
      }
      return raw;
    } catch {
      return raw;
    }
  }

  if (raw.startsWith("uploads/")) return `${appConfig.apiUrl}/${raw}`;
  if (raw.startsWith("/")) return `${appConfig.apiUrl}${raw}`;

  const uploadsMatch = raw.match(/(\/uploads\/[^?#]+)/i);
  if (uploadsMatch?.[1]) return `${appConfig.apiUrl}${uploadsMatch[1]}`;

  return `${appConfig.apiUrl}/${raw}`;
}
