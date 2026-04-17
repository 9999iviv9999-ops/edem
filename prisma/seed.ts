import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type GeneratedGym = {
  name: string;
  address: string;
  city: string;
  region?: string;
  okrug?: string;
  district?: string;
  chainName: string;
  externalProvider: "other";
  externalId: string;
};

const gymsPath = join(process.cwd(), "prisma", "gyms-generated.json");
const generatedGymsRaw: GeneratedGym[] = JSON.parse(readFileSync(gymsPath, "utf8"));

/** Москва в начале: при обрыве по таймауту деплоя в БД попадает столица. */
const generatedGyms = [...generatedGymsRaw].sort((a, b) => {
  const am = a.city === "Москва" ? 0 : 1;
  const bm = b.city === "Москва" ? 0 : 1;
  return am - bm;
});

const CHUNK = 2500;

/** Ожидаемое число сид-записей по Москве (округ × район × сети) — см. build-seed-data.mjs + cityDivisions. */
const MOSCOW_SEED_EXPECTED_MIN = 8_000;

function mapSlice(slice: GeneratedGym[]) {
  return slice.map((g) => ({
    name: g.name,
    address: g.address,
    city: g.city,
    region: g.region ?? null,
    okrug: g.okrug ?? null,
    district: g.district ?? null,
    chainName: g.chainName,
    externalProvider: g.externalProvider,
    externalId: g.externalId
  }));
}

async function seedGymRows(rows: GeneratedGym[], label: string) {
  console.log(`${label} (${rows.length} rows) …`);
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = mapSlice(rows.slice(i, i + CHUNK));
    const res = await prisma.gym.createMany({ data: slice, skipDuplicates: true });
    console.log(`  … ${Math.min(i + slice.length, rows.length)} / ${rows.length} (inserted ${res.count} this batch)`);
  }
}

async function main() {
  const totalSeed = await prisma.gym.count({
    where: { externalId: { startsWith: "seed-" } }
  });
  const moscowSeed = await prisma.gym.count({
    where: { externalId: { startsWith: "seed-" }, city: "Москва" }
  });

  const fullCatalogOk = totalSeed > 40_000 && moscowSeed >= MOSCOW_SEED_EXPECTED_MIN;

  if (process.env.FORCE_GYM_SEED !== "1" && fullCatalogOk) {
    console.log(
      "Gym seed skipped: каталог и Москва в норме. FORCE_GYM_SEED=1 — полная перезаливка seed-* из gyms-generated.json."
    );
    return;
  }

  if (process.env.FORCE_GYM_SEED === "1") {
    const delSeed = await prisma.gym.deleteMany({
      where: { externalId: { startsWith: "seed-" } }
    });
    if (delSeed.count > 0) {
      console.log(`FORCE_GYM_SEED: removed ${delSeed.count} previous seed-* gyms before reload.`);
    }
  } else if (totalSeed > 40_000 && moscowSeed < MOSCOW_SEED_EXPECTED_MIN) {
    const delMoscow = await prisma.gym.deleteMany({
      where: { city: "Москва", externalId: { startsWith: "seed-" } }
    });
    if (delMoscow.count > 0) {
      console.log(
        `Moscow backfill: removed ${delMoscow.count} old seed-* Moscow rows (старий формат без районов), догружаем актуальный сид.`
      );
    }
    const moscowRows = generatedGymsRaw.filter((g) => g.city === "Москва");
    await seedGymRows(moscowRows, "Догрузка только Москвы");
    console.log("Gym seed done (Moscow backfill).");
    return;
  }

  const removed = await prisma.gym.deleteMany({ where: { externalId: null } });
  if (removed.count > 0) {
    console.log(`Removed ${removed.count} legacy gyms (no externalId) to avoid duplicates.`);
  }
  await seedGymRows(generatedGyms, `Seeding ${generatedGyms.length} gyms from gyms-generated.json`);
  console.log("Gym seed done.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
