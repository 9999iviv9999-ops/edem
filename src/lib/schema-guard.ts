import { prisma } from "./prisma";

/**
 * Проверяет, что таблица User в БД содержит все колонки, которые ожидает текущий Prisma Client
 * (иначе любой find/create без узкого select падает с P2022 и клиент видит 500).
 * Отключение только для аварийного обслуживания: OPS_DISABLE_SCHEMA_GUARD=1
 */
export async function assertPrismaUserTableQueryable(): Promise<void> {
  if (process.env.OPS_DISABLE_SCHEMA_GUARD === "1") {
    console.warn("schema-guard: skipped (OPS_DISABLE_SCHEMA_GUARD=1)");
    return;
  }
  try {
    await prisma.$queryRawUnsafe(`SELECT * FROM "User" LIMIT 0`);
  } catch (err) {
    console.error(
      "Schema guard: таблица User недоступна в формате Prisma (миграции не применены или нет прав). Примените prisma migrate deploy от суперпользователя БД при ошибке «must be owner»."
    );
    throw err;
  }
}
