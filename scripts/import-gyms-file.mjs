/**
 * Import gyms from user file (JSON or CSV).
 *
 * Usage:
 *   node scripts/import-gyms-file.mjs "C:/path/gyms.json"
 *   node scripts/import-gyms-file.mjs "C:/path/gyms.csv"
 *   node scripts/import-gyms-file.mjs scripts/data/moscow-cao-gyms.json
 *
 * JSON — один из вариантов:
 * 1) Массив объектов с полями name, address, city, okrug?, district?, region?, chainName?, latitude?, longitude?
 * 2) Объект каталога по округу:
 *    { "format": "edem-city-okrug-districts", "city", "okrug", "region"?, "districts": [
 *        { "district": "Арбат", "venues": [ { "name", "address", "chainName"? } ] }
 *      ] }
 *
 * CSV columns:
 *   name,address,city,okrug,district,region,chainName,latitude,longitude
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const filePath = process.argv[2];
if (!filePath) {
  console.error("Pass file path. Example: node scripts/import-gyms-file.mjs C:/data/gyms_cao_moscow.json");
  process.exit(1);
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\"") {
      if (q && line[i + 1] === "\"") {
        cur += "\"";
        i++;
      } else {
        q = !q;
      }
      continue;
    }
    if (!q && (ch === "," || ch === ";")) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseCsv(text) {
  const rows = text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!rows.length) return [];
  const head = parseCsvLine(rows[0]).map((h) => h.trim());
  return rows.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const obj = {};
    head.forEach((k, i) => {
      obj[k] = vals[i] ?? "";
    });
    return obj;
  });
}

function readData(p) {
  const text = fs.readFileSync(p, "utf8");
  const ext = path.extname(p).toLowerCase();
  if (ext === ".json") return JSON.parse(text);
  if (ext === ".csv") return parseCsv(text);
  throw new Error(`Unsupported extension ${ext}. Use .json or .csv`);
}

function asNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toExternalId(row) {
  const source = `${row.name || ""}|${row.address || ""}|${row.city || ""}|${row.district || ""}`;
  return `user-${crypto.createHash("sha1").update(source).digest("hex").slice(0, 24)}`;
}

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown>[]}
 */
function jsonToRows(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && "districts" in raw) {
    const o = /** @type {Record<string, unknown>} */ (raw);
    const city = String(o.city || "").trim();
    const okrug = String(o.okrug || "").trim() || null;
    const region = String(o.region || "").trim() || null;
    const districts = o.districts;
    if (!city || !Array.isArray(districts)) {
      throw new Error("Catalog object needs non-empty city and districts[]");
    }
    const rows = [];
    for (const block of districts) {
      if (!block || typeof block !== "object") continue;
      const b = /** @type {Record<string, unknown>} */ (block);
      const district = String(b.district || b.name || "").trim();
      const venues = b.venues || b.items;
      if (!district || !Array.isArray(venues)) continue;
      for (const v of venues) {
        if (!v || typeof v !== "object") continue;
        const row = /** @type {Record<string, unknown>} */ (v);
        rows.push({
          name: row.name,
          address: row.address,
          city,
          okrug,
          district,
          region: region || null,
          chainName: row.chainName,
          latitude: row.latitude,
          longitude: row.longitude
        });
      }
    }
    return rows;
  }
  throw new Error("JSON must be an array of rows or a catalog object with city, okrug, districts[]");
}

async function main() {
  const raw = readData(filePath);
  const rawRows = path.extname(filePath).toLowerCase() === ".json" ? jsonToRows(raw) : raw;
  if (!Array.isArray(rawRows)) throw new Error("CSV root parse failed");

  const cleaned = rawRows
    .map((r) => ({
      name: String(r.name || "").trim(),
      address: String(r.address || "").trim(),
      city: String(r.city || "").trim(),
      okrug: String(r.okrug || "").trim() || null,
      district: String(r.district || "").trim() || null,
      region: String(r.region || "").trim() || null,
      chainName: String(r.chainName || "").trim() || null,
      latitude: asNumber(r.latitude),
      longitude: asNumber(r.longitude),
      externalProvider: "other",
      externalId: toExternalId(r)
    }))
    .filter((r) => r.name && r.address && r.city);

  if (!cleaned.length) {
    console.log("No valid rows (need at least name,address,city).");
    return;
  }

  const CHUNK = 2000;
  let inserted = 0;
  for (let i = 0; i < cleaned.length; i += CHUNK) {
    const slice = cleaned.slice(i, i + CHUNK);
    const res = await prisma.gym.createMany({ data: slice, skipDuplicates: true });
    inserted += res.count;
    console.log(`Imported ${Math.min(i + slice.length, cleaned.length)} / ${cleaned.length} (inserted ${res.count})`);
  }
  console.log(`Done. Inserted: ${inserted}, total parsed: ${cleaned.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

