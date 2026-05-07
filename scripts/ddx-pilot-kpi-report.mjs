#!/usr/bin/env node
/**
 * KPI для пилота DDX: регистрации, выбор зала DDX как основного, лайки/матчи/сообщения в контексте DDX.
 *
 *   node scripts/ddx-pilot-kpi-report.mjs --from 2026-04-01 --to 2026-06-30
 *   node scripts/ddx-pilot-kpi-report.mjs --from 2026-04-01 --to 2026-06-30 --cities "Москва,Санкт-Петербург"
 *   node scripts/ddx-pilot-kpi-report.mjs --from ... --to ... --json
 *
 * Нужен DATABASE_URL (как у API). DDX-залы: Gym.chainName startsWith "DDX" (как в каталоге).
 */
import process from "node:process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ddxGymWhere = { chainName: { startsWith: "DDX" } };

function parseArgs() {
  const args = process.argv.slice(2);
  let fromStr;
  let toStr;
  let cities = null;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--from" && args[i + 1]) fromStr = args[++i];
    else if (a === "--to" && args[i + 1]) toStr = args[++i];
    else if (a === "--cities" && args[i + 1]) {
      cities = args[++i]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === "--json") json = true;
  }
  return { fromStr, toStr, cities, json };
}

function dayRangeUtc(fromStr, toStr) {
  const from = new Date(`${fromStr}T00:00:00.000Z`);
  const to = new Date(`${toStr}T23:59:59.999Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Неверные --from / --to (формат YYYY-MM-DD)");
  }
  if (from > to) throw new Error("--from позже --to");
  return { from, to };
}

async function main() {
  const { fromStr, toStr, cities, json } = parseArgs();
  if (!fromStr || !toStr) {
    console.error(
      "Использование: node scripts/ddx-pilot-kpi-report.mjs --from YYYY-MM-DD --to YYYY-MM-DD [--cities \"Город1,Город2\"] [--json]"
    );
    process.exit(1);
  }
  const { from, to } = dayRangeUtc(fromStr, toStr);

  const userCityFilter = cities?.length ? { city: { in: cities } } : {};

  const matchWhereDdx = {
    createdAt: { gte: from, lte: to },
    gym: ddxGymWhere
  };
  if (cities?.length) {
    matchWhereDdx.OR = [
      { userA: { isBanned: false, city: { in: cities } } },
      { userB: { isBanned: false, city: { in: cities } } }
    ];
  }

  const [
    registrations,
    usersWithPrimaryDdxEver,
    primaryDdxSetInPeriod,
    likesDdx,
    matchesDdx,
    messagesInDdxMatches,
    distinctMessageAuthors,
    topDdxGymsPrimary
  ] = await Promise.all([
    prisma.user.count({
      where: {
        createdAt: { gte: from, lte: to },
        isBanned: false,
        ...userCityFilter
      }
    }),
    prisma.userGymMembership.count({
      where: {
        isPrimary: true,
        gym: ddxGymWhere,
        user: { isBanned: false, ...userCityFilter }
      }
    }),
    prisma.userGymMembership.count({
      where: {
        isPrimary: true,
        createdAt: { gte: from, lte: to },
        gym: ddxGymWhere,
        user: { isBanned: false, ...userCityFilter }
      }
    }),
    prisma.like.count({
      where: {
        createdAt: { gte: from, lte: to },
        gym: ddxGymWhere,
        fromUser: { isBanned: false, ...userCityFilter }
      }
    }),
    prisma.match.count({
      where: matchWhereDdx
    }),
    prisma.message.count({
      where: {
        createdAt: { gte: from, lte: to },
        match: { gym: ddxGymWhere }
      }
    }),
    prisma.message
      .findMany({
        where: {
          createdAt: { gte: from, lte: to },
          match: { gym: ddxGymWhere },
          fromUser: { isBanned: false, ...userCityFilter }
        },
        select: { fromUserId: true },
        distinct: ["fromUserId"]
      })
      .then((rows) => rows.length),
    prisma.userGymMembership.groupBy({
      by: ["gymId"],
      where: {
        isPrimary: true,
        createdAt: { gte: from, lte: to },
        gym: ddxGymWhere,
        user: { isBanned: false, ...userCityFilter }
      },
      _count: { gymId: true },
      orderBy: { _count: { gymId: "desc" } },
      take: 15
    })
  ]);

  const gymIds = topDdxGymsPrimary.map((r) => r.gymId);
  const gyms =
    gymIds.length > 0
      ? await prisma.gym.findMany({
          where: { id: { in: gymIds } },
          select: { id: true, name: true, city: true, address: true, chainName: true }
        })
      : [];
  const gymMap = new Map(gyms.map((g) => [g.id, g]));

  const payload = {
    period: { from: fromStr, to: toStr, timezoneNote: "границы суток в UTC" },
    citiesFilter: cities ?? null,
    registrations,
    usersWithPrimaryDdxClub_snapshot: usersWithPrimaryDdxEver,
    primaryDdxSelections_inPeriod: primaryDdxSetInPeriod,
    likes_atDdxGyms_inPeriod: likesDdx,
    matches_atDdxGyms_inPeriod: matchesDdx,
    messages_inDdxChats_inPeriod: messagesInDdxMatches,
    distinctUsersSendingMessages_inDdxChats_inPeriod: distinctMessageAuthors,
    topDdxGymsByPrimarySelections_inPeriod: topDdxGymsPrimary.map((row) => {
      const g = gymMap.get(row.gymId);
      return {
        gymId: row.gymId,
        primarySelections: row._count.gymId,
        name: g?.name ?? "?",
        city: g?.city ?? "?",
        address: g?.address ?? "?"
      };
    })
  };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const cityLine = cities?.length ? `Фильтр городов (профиль пользователя): ${cities.join(", ")}` : "Города: все";

  console.log(`# EDEM × DDX — KPI за период ${fromStr} … ${toStr}
${cityLine}
Часовой пояс границ: UTC (00:00 … 23:59:59.999).

| Метрика | Значение |
|--------|----------|
| Новые регистрации (не забанены) | ${registrations} |
| Снимок: пользователей с основным залом DDX (на конец выборки) | ${usersWithPrimaryDdxEver} |
| В периоде впервые выбран основной зал DDX | ${primaryDdxSetInPeriod} |
| Лайки в контексте клуба DDX | ${likesDdx} |
| Матчи (чаты), завязанные на зал DDX | ${matchesDdx} |
| Сообщения в чатах по залам DDX | ${messagesInDdxMatches} |
| Уникальных авторов сообщений (DDX-чаты) | ${distinctMessageAuthors} |

## Топ клубов DDX по выбору «основной зал» в периоде
`);
  for (const row of payload.topDdxGymsByPrimarySelections_inPeriod) {
    console.log(`- **${row.city}** — ${row.name} (${row.primarySelections}): ${row.address}`);
  }
  console.log(`
---
*Удержание (return rate) по когортам в этом скрипте не считается — нужны отдельные правила (например, активность через 7/30 дней после регистрации).*
`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
