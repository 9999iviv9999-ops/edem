/**
 * Догружает клубы Alex Fitness (Алекс Фитнес) в Gym (без удаления остальных записей).
 *
 * Источник: scripts/data/alex-fitness-clubs.json (адреса с alexfitness.ru, региональные поддомены).
 *   externalId: af-*
 *   chainName: "Alex Fitness"
 *
 *   node scripts/import-alex-fitness-clubs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataPath = path.join(root, "scripts", "data", "alex-fitness-clubs.json");

const CHAIN = "Alex Fitness";

async function main() {
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Missing ${dataPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  if (!Array.isArray(raw)) throw new Error("alex-fitness-clubs.json must be a JSON array");

  const rows = raw
    .map((g) => ({
      name: String(g.name || "").trim(),
      address: String(g.address || "").trim(),
      city: String(g.city || "").trim(),
      region: g.region != null ? String(g.region).trim() || null : null,
      okrug: g.okrug != null ? String(g.okrug).trim() || null : null,
      district: g.district != null ? String(g.district).trim() || null : null,
      chainName: CHAIN,
      latitude: typeof g.latitude === "number" ? g.latitude : null,
      longitude: typeof g.longitude === "number" ? g.longitude : null,
      externalProvider: "other",
      externalId: String(g.externalId || "").trim()
    }))
    .filter((g) => g.name && g.address && g.city && g.externalId);

  if (!rows.length) {
    throw new Error("No valid Alex Fitness rows in alex-fitness-clubs.json");
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
      `Alex Fitness import: ${Math.min(i + slice.length, deduped.length)} / ${deduped.length} (inserted ${res.count} this batch)`
    );
  }

  const total = await prisma.gym.count();
  const af = await prisma.gym.count({ where: { chainName: { startsWith: "Alex Fitness" } } });
  console.log(`Done. Inserted new rows (approx): ${inserted}. Total gyms: ${total}, Alex Fitness: ${af}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
