/**
 * Пошаговый импорт каталога вида edem-city-okrug-districts:
 * - по одному району: --district="Арбат"
 * - все районы по очереди с паузой: --all --sleep-ms=1200
 *
 * Usage:
 *   node scripts/import-gyms-catalog-step.mjs --file=scripts/data/moscow-cao-gyms.json --district=Арбат
 *   node scripts/import-gyms-catalog-step.mjs --file=scripts/data/moscow-cao-gyms.json --all --sleep-ms=1200
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

const prisma = new PrismaClient();
config({ path: path.join(process.cwd(), ".env") });

function parseArgs(argv) {
  const out = {
    file: "",
    district: "",
    all: false,
    sleepMs: 1000
  };
  for (const a of argv) {
    if (a.startsWith("--file=")) out.file = a.slice(7);
    else if (a.startsWith("--district=")) out.district = a.slice(11);
    else if (a === "--all") out.all = true;
    else if (a.startsWith("--sleep-ms=")) out.sleepMs = Math.max(0, parseInt(a.slice(11), 10) || 0);
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toExternalId(row) {
  const source = `${row.name}|${row.address}|${row.city}|${row.okrug || ""}|${row.district || ""}`;
  return `manual-${crypto.createHash("sha1").update(source).digest("hex").slice(0, 24)}`;
}

async function importDistrictRows(catalog, districtName) {
  const block = (catalog.districts || []).find((d) => String(d.district || "").trim() === districtName);
  if (!block) throw new Error(`District not found in catalog: ${districtName}`);
  const venues = Array.isArray(block.venues) ? block.venues : [];
  const rows = venues
    .map((v) => ({
      name: String(v.name || "").trim(),
      address: String(v.address || "").trim(),
      city: String(catalog.city || "").trim(),
      okrug: String(catalog.okrug || "").trim() || null,
      district: districtName,
      region: String(catalog.region || "").trim() || null,
      chainName: String(v.chainName || "").trim() || null
    }))
    .filter((r) => r.name && r.address && r.city)
    .map((r) => ({
      ...r,
      externalProvider: "other",
      externalId: toExternalId(r)
    }));

  if (!rows.length) {
    console.log(`Skip ${districtName}: no valid rows`);
    return { parsed: 0, inserted: 0 };
  }

  const res = await prisma.gym.createMany({ data: rows, skipDuplicates: true });
  console.log(`${districtName}: inserted ${res.count} / ${rows.length}`);
  return { parsed: rows.length, inserted: res.count };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error("Required: --file=scripts/data/....json");
    process.exit(1);
  }
  if (!args.all && !args.district) {
    console.error("Use either --district=... or --all");
    process.exit(1);
  }

  const filePath = path.isAbsolute(args.file) ? args.file : path.join(process.cwd(), args.file);
  const catalog = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!catalog || !Array.isArray(catalog.districts) || !catalog.city) {
    throw new Error("Bad catalog format: expected city + districts[]");
  }

  if (!args.all) {
    await importDistrictRows(catalog, args.district.trim());
    return;
  }

  let totalParsed = 0;
  let totalInserted = 0;
  const districtNames = catalog.districts.map((d) => String(d.district || "").trim()).filter(Boolean);
  for (let i = 0; i < districtNames.length; i++) {
    const d = districtNames[i];
    const { parsed, inserted } = await importDistrictRows(catalog, d);
    totalParsed += parsed;
    totalInserted += inserted;
    if (i < districtNames.length - 1 && args.sleepMs > 0) await sleep(args.sleepMs);
  }
  console.log(`Done. Parsed ${totalParsed}, inserted ${totalInserted}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

