export type Locale = "en" | "ru";

export const LOCALE_STORAGE_KEY = "geneso-locale";

function preferredFromEnv(): Locale | null {
  const v = import.meta.env.VITE_DEFAULT_LOCALE?.trim().toLowerCase();
  if (v === "ru" || v === "en") return v;
  return null;
}

function navigatorPrefersRussian(): boolean {
  const list = typeof navigator !== "undefined" ? navigator.languages : undefined;
  if (list?.length) {
    for (const lang of list) {
      if (lang?.toLowerCase().startsWith("ru")) return true;
    }
  }
  const primary = navigator?.language?.toLowerCase() ?? "";
  return primary.startsWith("ru");
}

export function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (saved === "en" || saved === "ru") return saved;
  const fromEnv = preferredFromEnv();
  if (fromEnv) return fromEnv;
  return navigatorPrefersRussian() ? "ru" : "en";
}
