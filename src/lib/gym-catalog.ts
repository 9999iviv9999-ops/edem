import type { Prisma } from "@prisma/client";

/**
 * Сети, разрешённые в публичном каталоге залов (GET /api/gyms, /api/gyms/cities).
 * DDX / World Class / Alex Fitness / Fitness House и локальные сети — по префиксу chainName;
 * X-Fit — фиксированные варианты.
 */
export const GYM_CATALOG_CHAIN_NAMES = [
  "DDX Fitness",
  "X-Fit",
  "World Class",
  "Alex Fitness",
  "Fitness House",
  "Citrus Fitness",
  "Носорог",
  "Колизей",
  "Profilaktika",
  "Атлетика",
  "МетроФитнес",
  "Космос",
  "Территория спорта",
  "Bright Fit",
  "Strong&Smart",
  "ParkCity Fitness",
  "Видгоф",
  "Про-спорт",
  "My Club",
  "VIP GYM",
  "Spirit Fitness",
  "Adrenaline"
] as const;

export function gymCatalogChainsFilter(): Prisma.GymWhereInput {
  return {
    OR: [
      { chainName: { startsWith: "DDX" } },
      { chainName: { startsWith: "World Class" } },
      { chainName: { startsWith: "Alex Fitness" } },
      { chainName: { startsWith: "Fitness House" } },
      { chainName: { startsWith: "Citrus Fitness" } },
      { chainName: { startsWith: "Носорог" } },
      { chainName: { startsWith: "Колизей" } },
      { chainName: { startsWith: "Profilaktika" } },
      { chainName: { startsWith: "Атлетика" } },
      { chainName: { startsWith: "МетроФитнес" } },
      { chainName: { startsWith: "Космос" } },
      { chainName: { startsWith: "Территория спорта" } },
      { chainName: { startsWith: "Bright Fit" } },
      { chainName: { startsWith: "Strong&Smart" } },
      { chainName: { startsWith: "ParkCity Fitness" } },
      { chainName: { startsWith: "Видгоф" } },
      { chainName: { startsWith: "Про-спорт" } },
      { chainName: { startsWith: "My Club" } },
      { chainName: { startsWith: "VIP GYM" } },
      { chainName: { startsWith: "Spirit Fitness" } },
      { chainName: { startsWith: "Adrenaline" } },
      { chainName: "X-Fit" },
      { chainName: "XFIT" },
      { chainName: "XFit" }
    ]
  };
}
