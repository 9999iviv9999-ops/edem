import { z } from "zod";

/** Идентификаторы Prisma (cuid / uuid) из body и query. */
export const zCuid = z.string().trim().min(1).max(36);

/** Компактная строка фильтров вида a,b,c в query. */
export const zCommaList = (maxLen: number) => z.string().max(maxLen).optional();
