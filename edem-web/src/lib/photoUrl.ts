function stripLeadingWww(hostname: string): string {
  return hostname.replace(/^www\./i, "");
}

/** Origin, с которого реально отдаются файлы `/uploads/*` (API при split-деплое, иначе текущий сайт). */
function uploadsServingOrigin(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      /* ignore */
    }
  }
  return typeof window !== "undefined" ? window.location.origin : "";
}

function configuredApiHostname(): string | null {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!raw) return null;
  try {
    return stripLeadingWww(new URL(raw).hostname);
  } catch {
    return null;
  }
}

/** Хост — «наш» для путей /uploads/ (SPA, API из env, localhost). */
function isOurUploadsHostname(hostname: string): boolean {
  const h = stripLeadingWww(hostname);
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  const apiH = configuredApiHostname();
  if (apiH && h === apiH) return true;
  if (typeof window === "undefined") return false;
  return h === stripLeadingWww(window.location.hostname);
}

function pathStartsWithUploads(pathname: string): boolean {
  return pathname.toLowerCase().startsWith("/uploads/");
}

/** Приводит URL фото к абсолютному URL загрузки с origin, где лежит файл. */
export function normalizePhotoUrl(url?: string | null): string {
  const value = (url ?? "").trim();
  if (!value) return "";
  if (value.startsWith("blob:") || value.startsWith("data:")) return value;

  const lower = value.toLowerCase();
  if (lower.startsWith("uploads/") && !value.startsWith("/")) {
    const i = lower.indexOf("uploads/");
    return `${uploadsServingOrigin()}/${value.slice(i)}`;
  }

  if (value.startsWith("/")) {
    const pathOnly = value.split("?")[0];
    if (pathStartsWithUploads(pathOnly)) {
      const rest = value.slice(pathOnly.length);
      return `${uploadsServingOrigin()}${pathOnly}${rest}`;
    }
    return `${typeof window !== "undefined" ? window.location.origin : ""}${value}`;
  }

  if (value.startsWith("//")) {
    try {
      const parsed = new URL(`https:${value}`);
      if (!pathStartsWithUploads(parsed.pathname)) return `https:${value}`;
      if (isOurUploadsHostname(parsed.hostname)) {
        return `${uploadsServingOrigin()}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      return `https:${value}`;
    } catch {
      return value;
    }
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (!pathStartsWithUploads(parsed.pathname)) return value;
      if (isOurUploadsHostname(parsed.hostname)) {
        return `${uploadsServingOrigin()}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      return value;
    } catch {
      return value;
    }
  }

  const uploadMatch = value.match(/(\/uploads\/[^?#]+)(\?[^#]*)?/i);
  if (uploadMatch?.[1]) {
    return `${uploadsServingOrigin()}${uploadMatch[1]}${uploadMatch[2] ?? ""}`;
  }
  return value;
}

/**
 * Как хранить в форме профиля: для «наших» /uploads/ — относительный путь (как ждёт API),
 * для S3/CDN — полный URL.
 */
export function canonicalPhotoForForm(url: string): string {
  const t = (url || "").trim();
  if (!t) return t;
  if (t.startsWith("blob:") || t.startsWith("data:")) return t;
  if (/^\/uploads\//i.test(t)) {
    const i = t.toLowerCase().indexOf("/uploads/");
    return t.slice(i);
  }
  if (/^uploads\//i.test(t)) {
    const i = t.toLowerCase().indexOf("uploads/");
    return `/${t.slice(i)}`;
  }
  const expanded = normalizePhotoUrl(t);
  try {
    const u = new URL(expanded, uploadsServingOrigin() || "http://localhost");
    if (pathStartsWithUploads(u.pathname) && isOurUploadsHostname(u.hostname)) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
  } catch {
    /* keep expanded */
  }
  return expanded;
}
