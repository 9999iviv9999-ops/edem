/**
 * Полная перезаливка таблицы Gym только клубами DDX из scripts/data/ddx-clubs-real.json.
 * После этого при необходимости догружайте другие сети отдельно (не удаляются этим скриптом):
 *   npm run import:gyms:xfit
 *
 * Usage:
 *   node scripts/import-ddx-only.mjs
 *
 * Поведение:
 * - полностью очищает таблицу Gym
 * - подгружает DDX-записи из scripts/data/ddx-clubs-real.json
 *   (если файла нет — fallback на prisma/gyms-generated.json)
 * - вставляет через createMany(skipDuplicates)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const gymsPath = path.join(root, "prisma", "gyms-generated.json");
const realDdxPath = path.join(root, "scripts", "data", "ddx-clubs-real.json");

function isDDX(chainName) {
  return String(chainName || "").toLowerCase().includes("ddx");
}

async function main() {
  const sourcePath = fs.existsSync(realDdxPath) ? realDdxPath : gymsPath;
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing ${sourcePath}`);
  }
  const raw = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  if (!Array.isArray(raw)) throw new Error("gyms-generated.json must be array");

  const ddxRows = raw
    .filter((g) => isDDX(g.chainName) || sourcePath === realDdxPath)
    .map((g) => ({
      name: g.name,
      address: g.address,
      city: g.city,
      okrug: g.okrug ?? null,
      district: g.district ?? null,
      region: g.region ?? null,
      chainName: g.chainName ?? "DDX Fitness",
      latitude: g.latitude ?? null,
      longitude: g.longitude ?? null,
      externalProvider: g.externalProvider ?? "other",
      externalId: g.externalId
    }))
    .filter((g) => g.name && g.address && g.city && g.externalId);

  if (!ddxRows.length) {
    throw new Error(`No DDX rows found in ${sourcePath}`);
  }

  const deduped = [];
  const seen = new Set();
  for (const row of ddxRows) {
    const key = `${row.city}|${row.name}|${row.address}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  const removed = await prisma.gym.deleteMany({});

  const CHUNK = 2500;
  let inserted = 0;
  for (let i = 0; i < deduped.length; i += CHUNK) {
    const slice = deduped.slice(i, i + CHUNK);
    const res = await prisma.gym.createMany({ data: slice, skipDuplicates: true });
    inserted += res.count;
    console.log(`DDX import: ${Math.min(i + slice.length, deduped.length)} / ${deduped.length} (inserted ${res.count})`);
  }

  const left = await prisma.gym.count();
  const leftDdx = await prisma.gym.count({
    where: { chainName: { startsWith: "DDX" } }
  });

  console.log(`Source: ${path.relative(root, sourcePath)}`);
  console.log(`Removed old gyms: ${removed.count}`);
  console.log(`Inserted/updated DDX gyms: ${inserted}`);
  console.log(`Catalog total: ${left}, DDX in catalog: ${leftDdx}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

