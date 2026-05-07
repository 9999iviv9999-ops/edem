/**
 * Догружает клубы World Class в Gym (без удаления остальных записей).
 *
 * Источник: scripts/data/world-class-clubs.json
 *   externalId: wc-*
 *   chainName: "World Class"
 *
 *   node scripts/import-world-class-clubs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataPath = path.join(root, "scripts", "data", "world-class-clubs.json");

async function main() {
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Missing ${dataPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  if (!Array.isArray(raw)) throw new Error("world-class-clubs.json must be a JSON array");

  const rows = raw
    .map((g) => ({
      name: String(g.name || "").trim(),
      address: String(g.address || "").trim(),
      city: String(g.city || "").trim(),
      region: g.region != null ? String(g.region).trim() || null : null,
      okrug: g.okrug != null ? String(g.okrug).trim() || null : null,
      district: g.district != null ? String(g.district).trim() || null : null,
      chainName: "World Class",
      latitude: typeof g.latitude === "number" ? g.latitude : null,
      longitude: typeof g.longitude === "number" ? g.longitude : null,
      externalProvider: "other",
      externalId: String(g.externalId || "").trim()
    }))
    .filter((g) => g.name && g.address && g.city && g.externalId);

  if (!rows.length) {
    throw new Error("No valid World Class rows in world-class-clubs.json");
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
      `World Class import: ${Math.min(i + slice.length, deduped.length)} / ${deduped.length} (inserted ${res.count} this batch)`
    );
  }

  const total = await prisma.gym.count();
  const wc = await prisma.gym.count({ where: { chainName: { startsWith: "World Class" } } });
  console.log(`Done. Inserted new rows (approx): ${inserted}. Total gyms: ${total}, World Class: ${wc}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
