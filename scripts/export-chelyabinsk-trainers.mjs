#!/usr/bin/env node
/**
 * Выгрузка тренеров ЭДЕМ, у которых в профиле есть зал в Челябинске из каталога (как в БД).
 * Не парсит сайты клубов — только User + UserGymMembership + Gym.
 *
 * Требуется DATABASE_URL (см. .env). На проде: скопировать .env или выставить переменную и запустить.
 *
 *   node scripts/export-chelyabinsk-trainers.mjs
 *   node scripts/export-chelyabinsk-trainers.mjs --include-city-only
 *
 * --include-city-only — добавить тренеров с city=Челябинск без привязки к залу (редко нужно).
 *
 * Файлы (не коммитить — в .gitignore):
 *   scripts/data/generated/chelyabinsk-trainers.json
 *   scripts/data/generated/chelyabinsk-trainers.csv
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const CITY = "Челябинск";
const OUT_DIR = path.join(process.cwd(), "scripts", "data", "generated");

const includeCityOnly = process.argv.includes("--include-city-only");

function csvCell(v) {
  if (v == null || v === "") return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCsv(cols) {
  return cols.map(csvCell).join(",");
}

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("export-chelyabinsk-trainers: задайте DATABASE_URL (файл .env или переменная окружения).");
    process.exit(1);
  }

  const chlGyms = await prisma.gym.findMany({
    where: { city: CITY },
    select: { id: true, name: true, chainName: true, address: true }
  });
  const chlIds = chlGyms.map((g) => g.id);
  const gymById = new Map(chlGyms.map((g) => [g.id, g]));

  const whereMembership = {
    isTrainer: true,
    trainerVisible: true,
    isBanned: false,
    memberships: { some: { gymId: { in: chlIds } } }
  };

  const trainersByGym = await prisma.user.findMany({
    where: whereMembership,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      city: true,
      trainerHeadline: true,
      trainerContacts: true,
      trainerSpecializations: true,
      trainerPriceFrom: true,
      createdAt: true,
      updatedAt: true,
      memberships: {
        where: { gymId: { in: chlIds } },
        select: { isPrimary: true, gymId: true }
      }
    },
    orderBy: [{ name: "asc" }]
  });

  let extraCityOnly = [];
  if (includeCityOnly) {
    const idsFromGym = new Set(trainersByGym.map((u) => u.id));
    extraCityOnly = await prisma.user.findMany({
      where: {
        isTrainer: true,
        trainerVisible: true,
        isBanned: false,
        city: CITY,
        id: { notIn: [...idsFromGym] }
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        trainerHeadline: true,
        trainerContacts: true,
        trainerSpecializations: true,
        trainerPriceFrom: true,
        createdAt: true,
        updatedAt: true,
        memberships: { select: { isPrimary: true, gymId: true } }
      },
      orderBy: [{ name: "asc" }]
    });
  }

  const all = [...trainersByGym, ...extraCityOnly];

  function formatTrainer(u) {
    const chlM = u.memberships.filter((m) => chlIds.includes(m.gymId));
    const gyms = chlM
      .map((m) => {
        const g = gymById.get(m.gymId);
        return g ? `${g.name}${g.chainName ? ` (${g.chainName})` : ""}` : m.gymId;
      })
      .sort();
    const primary = chlM.find((m) => m.isPrimary);
    const primaryGym = primary ? gymById.get(primary.gymId) : null;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      city: u.city,
      trainerHeadline: u.trainerHeadline,
      trainerContacts: u.trainerContacts,
      trainerSpecializations: u.trainerSpecializations,
      trainerPriceFrom: u.trainerPriceFrom,
      gymsChelyabinsk: gyms,
      gymsChelyabinskJoined: gyms.join("; "),
      primaryGymChelyabinsk: primaryGym
        ? `${primaryGym.name}${primaryGym.chainName ? ` (${primaryGym.chainName})` : ""}`
        : "",
      source: extraCityOnly.some((x) => x.id === u.id) ? "city_only" : "gym_membership",
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString()
    };
  }

  const payload = all.map(formatTrainer);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, "chelyabinsk-trainers.json");
  const csvPath = path.join(OUT_DIR, "chelyabinsk-trainers.csv");
  fs.writeFileSync(jsonPath, JSON.stringify({ exportedAt: new Date().toISOString(), city: CITY, gymsInDb: chlGyms.length, trainers: payload }, null, 2), "utf8");

  const headers = [
    "id",
    "name",
    "email",
    "phone",
    "city",
    "gyms_chelyabinsk",
    "primary_gym",
    "headline",
    "contacts",
    "specializations",
    "price_from",
    "source",
    "updated_at"
  ];
  const csvLines = [
    rowToCsv(headers),
    ...payload.map((p) =>
      rowToCsv([
        p.id,
        p.name,
        p.email,
        p.phone,
        p.city,
        p.gymsChelyabinskJoined,
        p.primaryGymChelyabinsk,
        p.trainerHeadline,
        p.trainerContacts,
        (p.trainerSpecializations || []).join(", "),
        p.trainerPriceFrom ?? "",
        p.source,
        p.updatedAt
      ])
    )
  ];
  fs.writeFileSync(csvPath, csvLines.join("\n") + "\n", "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        gymsChelyabinskInDb: chlGyms.length,
        trainersExported: payload.length,
        json: jsonPath,
        csv: csvPath
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error("export-chelyabinsk-trainers:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
