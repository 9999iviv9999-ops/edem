export type Locale = "en" | "ru";

export const LOCALE_STORAGE_KEY = "geneso-locale";

export function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (saved === "en" || saved === "ru") return saved;
  const nav = navigator.language?.toLowerCase() ?? "";
  return nav.startsWith("ru") ? "ru" : "en";
}
