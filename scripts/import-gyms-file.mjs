/**
 * Import gyms from user file (JSON or CSV).
 *
 * Usage:
 *   node scripts/import-gyms-file.mjs "C:/path/gyms.json"
 *   node scripts/import-gyms-file.mjs "C:/path/gyms.csv"
 *
 * Expected columns/keys:
 *   name,address,city,district,region,chainName,latitude,longitude
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

async function main() {
  const raw = readData(filePath);
  if (!Array.isArray(raw)) throw new Error("File root must be an array");

  const cleaned = raw
    .map((r) => ({
      name: String(r.name || "").trim(),
      address: String(r.address || "").trim(),
      city: String(r.city || "").trim(),
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

