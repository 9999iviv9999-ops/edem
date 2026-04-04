/**
 * Импорт фитнес-центров из OpenStreetMap (Overpass) по городу и (опционально) району Москвы
 * или по всей площади города.
 *
 * Источник: OSM (leisure=fitness_centre; при пустом результате — amenity=gym).
 * Данные неполные; дозаполняйте вручную и через заявки пользователей.
 *
 * Usage:
 *   node scripts/fetch-gyms-osm.mjs --city=Москва --district=Тверской
 *   node scripts/fetch-gyms-osm.mjs --city=Москва --okrug=ЦАО
 *   node scripts/fetch-gyms-osm.mjs --city=Казань
 *   node scripts/fetch-gyms-osm.mjs --city=Москва --district=Арбат --dry-run --out=scripts/_gyms_osm_export.json
 *
 * Без --dry-run нужен DATABASE_URL и prisma generate; пишет в таблицу Gym (externalProvider=other, externalId=osm-*).
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter"
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function escapeOverpassString(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const HTTP_TIMEOUT_MS = 150000;

function postOverpass(query, mirrorIndex) {
  const url = MIRRORS[mirrorIndex % MIRRORS.length];
  const body = "data=" + encodeURIComponent(query);
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          if (raw.trimStart().startsWith("<")) {
            reject(new Error("HTML/XML from " + url));
            return;
          }
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error("Bad JSON: " + raw.slice(0, 120)));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(HTTP_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error("HTTP timeout " + HTTP_TIMEOUT_MS + "ms"));
    });
    req.write(body);
    req.end();
  });
}

async function overpassWithRetry(query) {
  let lastErr;
  for (let m = 0; m < MIRRORS.length * 2; m++) {
    try {
      return await postOverpass(query, m);
    } catch (e) {
      lastErr = e;
      await sleep(800 + m * 400);
    }
  }
  throw lastErr;
}

function loadMoscowPlan() {
  const p = path.join(__dirname, "moscow-parsed.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** Округ Москвы по названию района (rayon). */
function moscowOkrugForRayon(plan, rayon) {
  for (const o of plan.okrugs || []) {
    if (o.rayons?.includes(rayon)) return o.name;
  }
  return null;
}

/** Все районы округа (напр. ЦАО). */
function moscowRayonsForOkrug(plan, okrugName) {
  const o = plan.okrugs?.find((x) => x.name === okrugName);
  return o?.rayons?.length ? [...o.rayons] : [];
}

function buildAddress(tags) {
  if (!tags) return "";
  const street = tags["addr:street"] || tags["addr:place"] || "";
  const hn = tags["addr:housenumber"] || "";
  const unit = tags["addr:unit"] || "";
  const city = tags["addr:city"] || tags["addr:suburb"] || "";
  const line = [street, hn].filter(Boolean).join(", ");
  const withUnit = unit ? `${line}${line ? ", " : ""}${unit}` : line;
  if (withUnit) return city ? `${withUnit}, ${city}` : withUnit;
  return "";
}

function elementName(tags) {
  if (!tags) return "";
  return (tags.name || tags["name:ru"] || tags["name:en"] || "").trim();
}

/** Найти relation границы района внутри Москвы (ISO RU-MOW — надёжнее, чем place=city). */
function buildMoscowRayonRelQuery(districtName, adminLevel) {
  const n = escapeOverpassString(districtName);
  const al = String(adminLevel);
  return `[out:json][timeout:90];
area["ISO3166-2"="RU-MOW"]->.msk;
rel(area.msk)["boundary"="administrative"]["admin_level"="${al}"]["name"="${n}"];
out tags;
`;
}

/** POI внутри relation района (по id). */
function buildPoiInsideRelQuery(relId) {
  return `[out:json][timeout:90];
rel(${relId});
map_to_area;
(
  node["leisure"="fitness_centre"](area);
  way["leisure"="fitness_centre"](area);
  relation["leisure"="fitness_centre"](area);
  node["amenity"="gym"](area);
  way["amenity"="gym"](area);
);
out center tags;
`;
}

/** Вся Москва как субъект RU-MOW (граница города). */
function buildMoscowWholeQuery() {
  return `[out:json][timeout:120];
area["ISO3166-2"="RU-MOW"]->.a;
(
  node["leisure"="fitness_centre"](area.a);
  way["leisure"="fitness_centre"](area.a);
  relation["leisure"="fitness_centre"](area.a);
  node["amenity"="gym"](area.a);
  way["amenity"="gym"](area.a);
);
out center tags;
`;
}

function buildWholeCityQuery(cityName) {
  const n = escapeOverpassString(cityName);
  return `[out:json][timeout:120];
area[name="${n}"][place="city"]->.a;
(
  node["leisure"="fitness_centre"](area.a);
  way["leisure"="fitness_centre"](area.a);
  relation["leisure"="fitness_centre"](area.a);
  node["amenity"="gym"](area.a);
  way["amenity"="gym"](area.a);
);
out center tags;
`;
}

function buildWholeTownQuery(cityName) {
  const n = escapeOverpassString(cityName);
  return `[out:json][timeout:120];
area[name="${n}"][place="town"]->.a;
(
  node["leisure"="fitness_centre"](area.a);
  way["leisure"="fitness_centre"](area.a);
  relation["leisure"="fitness_centre"](area.a);
  node["amenity"="gym"](area.a);
  way["amenity"="gym"](area.a);
);
out center tags;
`;
}

function elementsToRows(elements, city, okrug, district) {
  const rows = [];
  const seen = new Set();
  for (const el of elements || []) {
    const t = el.tags || {};
    const name = elementName(t);
    if (!name) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const addr = buildAddress(t);
    const address = addr || `${name} (точка из OSM)`;
    const type = el.type === "node" ? "n" : el.type === "way" ? "w" : "r";
    const id = `${type}-${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({
      name,
      address,
      city,
      okrug: okrug || null,
      district: district || null,
      region: null,
      chainName: "OpenStreetMap",
      latitude: lat,
      longitude: lon,
      externalProvider: "other",
      externalId: `osm-${id}`
    });
  }
  return rows;
}

function parseArgs(argv) {
  const out = {
    city: "",
    district: "",
    okrug: "",
    dryRun: false,
    outFile: "",
    sleepMs: 900,
    configFile: ""
  };
  for (const a of argv) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a.startsWith("--city=")) out.city = a.slice(7);
    else if (a.startsWith("--district=")) out.district = a.slice(11);
    else if (a.startsWith("--okrug=")) out.okrug = a.slice(8);
    else if (a.startsWith("--out=")) out.outFile = a.slice(6);
    else if (a.startsWith("--sleep=")) out.sleepMs = parseInt(a.slice(8), 10) || 900;
    else if (a.startsWith("--config=")) out.configFile = a.slice(9);
  }
  if (out.configFile) {
    const j = JSON.parse(fs.readFileSync(out.configFile, "utf8"));
    if (j.city) out.city = j.city;
    if (j.district != null) out.district = j.district;
    if (j.okrug != null) out.okrug = j.okrug;
    if (j.dryRun) out.dryRun = true;
    if (j.out) out.outFile = j.out;
    if (j.sleepMs != null) out.sleepMs = j.sleepMs;
  }
  return out;
}

async function fetchForMoscowDistrict(districtName) {
  /** В OSM часто «Тверской район», в moscow-parsed — «Тверской». */
  const variants = [`${districtName} район`, `район ${districtName}`, districtName];
  for (const name of variants) {
    for (const al of [8, 9]) {
      const found = await overpassWithRetry(buildMoscowRayonRelQuery(name, al));
      const rel = (found.elements || []).find((e) => e.type === "relation");
      if (!rel?.id) continue;
      const data = await overpassWithRetry(buildPoiInsideRelQuery(rel.id));
      const els = data.elements || [];
      if (els.length) return els;
    }
  }
  return [];
}

async function fetchForCity(cityName) {
  if (cityName === "Москва") {
    const m = await overpassWithRetry(buildMoscowWholeQuery());
    if (m.elements?.length) return m.elements;
  }
  let data;
  try {
    data = await overpassWithRetry(buildWholeCityQuery(cityName));
  } catch {
    data = { elements: [] };
  }
  if (!data.elements?.length) {
    data = await overpassWithRetry(buildWholeTownQuery(cityName));
  }
  return data.elements || [];
}

async function importRows(rows, dryRun, outFile) {
  if (outFile) {
    fs.writeFileSync(outFile, JSON.stringify(rows, null, 2), "utf8");
    console.log("Wrote", outFile, "rows", rows.length);
  }
  if (dryRun) {
    console.log("Dry run: would upsert", rows.length, "gyms");
    return;
  }
  const prisma = new PrismaClient();
  try {
    let n = 0;
    for (const r of rows) {
      await prisma.gym.upsert({
        where: {
          externalProvider_externalId: {
            externalProvider: "other",
            externalId: r.externalId
          }
        },
        create: r,
        update: {
          name: r.name,
          address: r.address,
          city: r.city,
          okrug: r.okrug,
          district: r.district,
          latitude: r.latitude,
          longitude: r.longitude,
          chainName: r.chainName
        }
      });
      n++;
    }
    console.log("Upserted", n, "gyms into database");
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.city) {
    console.error("Укажите --city=Название. Для Москвы: --district=Район или --okrug=ЦАО");
    process.exit(1);
  }

  const city = args.city.trim();
  const plan = city === "Москва" ? loadMoscowPlan() : null;

  /** @type {{ district: string, okrug: string|null }[]} */
  const jobs = [];

  if (city === "Москва" && args.okrug) {
    const rayons = moscowRayonsForOkrug(plan, args.okrug);
    if (!rayons.length) {
      console.error("Неизвестный округ Москвы:", args.okrug);
      process.exit(1);
    }
    for (const d of rayons) jobs.push({ district: d, okrug: args.okrug });
  } else if (city === "Москва" && args.district) {
    const ok = moscowOkrugForRayon(plan, args.district);
    if (!ok) {
      console.error("Район не найден в moscow-parsed.json:", args.district);
      process.exit(1);
    }
    jobs.push({ district: args.district, okrug: ok });
  } else if (args.district && /^Город «/.test(args.district)) {
    jobs.push({ district: "", okrug: null });
  } else if (args.district) {
    console.error("Для городов кроме Москвы пока используйте только --city (весь город) или добавьте район в скрипт.");
    process.exit(1);
  } else {
    jobs.push({ district: "", okrug: null });
  }

  const allRows = [];

  function writeSnapshotIfNeeded() {
    if (!args.outFile) return;
    const byExt = new Map();
    for (const r of allRows) byExt.set(r.externalId, r);
    fs.writeFileSync(args.outFile, JSON.stringify([...byExt.values()], null, 2), "utf8");
  }

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    process.stdout.write(`\r${city} ${job.district || "(весь город)"} …                    `);
    try {
      let elements;
      if (city === "Москва" && job.district) {
        elements = await fetchForMoscowDistrict(job.district);
      } else {
        elements = await fetchForCity(city);
      }
      const rows = elementsToRows(elements, city, job.okrug, job.district || null);
      console.log("\n", job.district || city, "→ OSM элементов:", elements.length, "→ записей:", rows.length);
      allRows.push(...rows);
      writeSnapshotIfNeeded();
    } catch (e) {
      console.error("\nПропуск", job.district || city, ":", e.message || e);
      writeSnapshotIfNeeded();
    }
    if (i < jobs.length - 1) await sleep(args.sleepMs);
  }

  const byExt = new Map();
  for (const r of allRows) byExt.set(r.externalId, r);
  const unique = [...byExt.values()];
  console.log("Всего уникальных по OSM id:", unique.length, "(строк до слияния:", allRows.length, ")");

  await importRows(unique, args.dryRun, args.outFile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
