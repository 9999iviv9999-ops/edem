/**
 * Импорт простого списка "Название — Адрес" для ОДНОЙ зоны за запуск.
 *
 * Формат файла (.txt):
 *   # комментарии допускаются
 *   Фитнес-клуб "Пример" — ул. Примерная, д. 1
 *   Gym Name; ул. Вторая, д. 15
 *
 * Разделитель: "—" (длинное тире), "-" или ";".
 *
 * Usage:
 *   node scripts/import-gyms-list.mjs --file=scripts/data/moscow-cao-arbat.txt --city=Москва --okrug=ЦАО --district=Арбат --region=Москва
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs(argv) {
  const out = {
    file: "",
    city: "",
    okrug: "",
    district: "",
    region: "",
    chainName: ""
  };
  for (const a of argv) {
    if (a.startsWith("--file=")) out.file = a.slice(7);
    else if (a.startsWith("--city=")) out.city = a.slice(7);
    else if (a.startsWith("--okrug=")) out.okrug = a.slice(8);
    else if (a.startsWith("--district=")) out.district = a.slice(11);
    else if (a.startsWith("--region=")) out.region = a.slice(9);
    else if (a.startsWith("--chainName=")) out.chainName = a.slice(12);
  }
  return out;
}

function splitNameAddress(line) {
  const raw = line.trim();
  if (!raw || raw.startsWith("#")) return null;
  const parts = raw.split(/\s+[—-]\s+|;\s*/).map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return { name: parts[0], address: parts.slice(1).join(", ") };
}

function toExternalId(row) {
  const source = `${row.name}|${row.address}|${row.city}|${row.okrug || ""}|${row.district || ""}`;
  return `manual-${crypto.createHash("sha1").update(source).digest("hex").slice(0, 24)}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file || !args.city) {
    console.error("Required: --file=... --city=... (optional: --okrug --district --region --chainName)");
    process.exit(1);
  }

  const filePath = path.isAbsolute(args.file) ? args.file : path.join(process.cwd(), args.file);
  const text = fs.readFileSync(filePath, "utf8");
  const rows = text
    .split(/\r?\n/)
    .map(splitNameAddress)
    .filter(Boolean)
    .map((x) => ({
      name: x.name,
      address: x.address,
      city: args.city.trim(),
      okrug: args.okrug.trim() || null,
      district: args.district.trim() || null,
      region: args.region.trim() || null,
      chainName: args.chainName.trim() || null,
      externalProvider: "other",
      externalId: toExternalId({
        name: x.name,
        address: x.address,
        city: args.city.trim(),
        okrug: args.okrug.trim(),
        district: args.district.trim()
      })
    }));

  if (!rows.length) {
    console.log("No valid lines found. Use: Название — Адрес");
    return;
  }

  const result = await prisma.gym.createMany({ data: rows, skipDuplicates: true });
  console.log(`Imported ${result.count} / ${rows.length} from ${path.basename(filePath)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
