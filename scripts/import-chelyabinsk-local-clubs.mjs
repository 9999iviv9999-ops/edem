/**
 * Догружает локальные клубы Челябинска в Gym.
 *
 * Источник: scripts/data/chelyabinsk-local-clubs.json
 *   externalId: chl-*
 *   chainName: из поля chainName каждой записи
 *
 *   node scripts/import-chelyabinsk-local-clubs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataPath = path.join(root, "scripts", "data", "chelyabinsk-local-clubs.json");

async function main() {
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Missing ${dataPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  if (!Array.isArray(raw)) throw new Error("chelyabinsk-local-clubs.json must be a JSON array");

  const rows = raw
    .map((g) => ({
      name: String(g.name || "").trim(),
      address: String(g.address || "").trim(),
      city: String(g.city || "").trim(),
      region: g.region != null ? String(g.region).trim() || null : null,
      okrug: g.okrug != null ? String(g.okrug).trim() || null : null,
      district: g.district != null ? String(g.district).trim() || null : null,
      chainName: String(g.chainName || "").trim(),
      latitude: typeof g.latitude === "number" ? g.latitude : null,
      longitude: typeof g.longitude === "number" ? g.longitude : null,
      externalProvider: "other",
      externalId: String(g.externalId || "").trim()
    }))
    .filter((g) => g.name && g.address && g.city && g.chainName && g.externalId);

  if (!rows.length) {
    throw new Error("No valid rows in chelyabinsk-local-clubs.json");
  }

  const deduped = [];
  const seen = new Set();
  for (const row of rows) {
    const key = row.externalId.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < deduped.length; i += CHUNK) {
    const slice = deduped.slice(i, i + CHUNK);
    const res = await prisma.gym.createMany({ data: slice, skipDuplicates: true });
    inserted += res.count;
    console.log(
      `Chelyabinsk local import: ${Math.min(i + slice.length, deduped.length)} / ${deduped.length} (inserted ${res.count} this batch)`
    );
  }

  const total = await prisma.gym.count();
  const localTotal = await prisma.gym.count({
    where: {
      externalId: { startsWith: "chl-" }
    }
  });
  console.log(`Done. Inserted new rows (approx): ${inserted}. Total gyms: ${total}, Chl local rows: ${localTotal}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
