/**
 * Оставляет в каталоге только клубы DDX (по gyms-generated.json) и импортирует их в Gym.
 *
 * Usage:
 *   node scripts/import-ddx-only.mjs
 *
 * Поведение:
 * - удаляет из Gym все записи, где chainName не содержит "ddx"
 * - подгружает DDX-записи из prisma/gyms-generated.json
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

function isDDX(chainName) {
  return String(chainName || "").toLowerCase().includes("ddx");
}

async function main() {
  if (!fs.existsSync(gymsPath)) {
    throw new Error(`Missing ${gymsPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(gymsPath, "utf8"));
  if (!Array.isArray(raw)) throw new Error("gyms-generated.json must be array");

  const ddxRows = raw
    .filter((g) => isDDX(g.chainName))
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
    throw new Error("No DDX rows found in gyms-generated.json");
  }

  const removed = await prisma.gym.deleteMany({
    where: {
      OR: [{ chainName: null }, { chainName: { not: { startsWith: "DDX" } } }]
    }
  });

  const CHUNK = 2500;
  let inserted = 0;
  for (let i = 0; i < ddxRows.length; i += CHUNK) {
    const slice = ddxRows.slice(i, i + CHUNK);
    const res = await prisma.gym.createMany({ data: slice, skipDuplicates: true });
    inserted += res.count;
    console.log(`DDX import: ${Math.min(i + slice.length, ddxRows.length)} / ${ddxRows.length} (inserted ${res.count})`);
  }

  const left = await prisma.gym.count();
  const leftDdx = await prisma.gym.count({
    where: { chainName: { startsWith: "DDX" } }
  });

  console.log(`Removed non-DDX gyms: ${removed.count}`);
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

