/**
 * Внутригородские районы/округа из OpenStreetMap (Overpass API).
 * Сначала area[name][place=city], при пустом — place=town. Без around(): соседние мегаполисы давали ложные «районы».
 *
 * Usage: node scripts/fetch-city-rayons-overpass.mjs [--limit=N] [--offset=N] [--force]
 * --force — при полном прогоне (offset=0, без limit) не читать city-rayons-osm.json.
 *   При --offset/--limit всегда мержим с файлом на диске, иначе одна порция затрёт весь JSON.
 * Выход: scripts/city-rayons-osm.json
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SKIP = new Set([
  "Москва",
  "Санкт-Петербург",
  "Казань",
  "Екатеринбург",
  "Новосибирск",
  "Нижний Новгород",
  "Самара",
  "Ростов-на-Дону",
  "Уфа",
  "Краснодар",
  "Челябинск",
  "Омск",
  "Воронеж",
  "Пермь",
  "Волгоград",
  "Калуга"
]);

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

/** Пауза между городами (Overpass просит не ддосить) */
const SLEEP_MS = 600;

/** Ниже порога не дергаем Overpass (в OSM обычно нет районов; экономим ~800 запросов и часы работы). */
const MIN_POPULATION_FOR_OVERPASS = 50_000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function escapeOverpassString(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function isInnerDistrict(el) {
  const t = el.tags || {};
  if (el.type !== "relation" || t.boundary !== "administrative" || !t.name) return false;
  const al = parseInt(t.admin_level, 10);
  if (Number.isNaN(al) || al < 8 || al > 11) return false;
  const n = t.name;
  if (/область$/i.test(n) && n.includes(" ")) return false;
  if (/^Республика\s/i.test(n)) return false;
  if (al <= 6) return false;
  if (/федеральный округ/i.test(n)) return false;
  if (/городской округ/i.test(n) && al <= 7) return false;
  return true;
}

function parseNames(elements) {
  const names = new Set();
  for (const el of elements || []) {
    if (!isInnerDistrict(el)) continue;
    const n = el.tags?.name?.trim();
    if (n) names.add(n);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "ru"));
}

function postOverpass(query, mirrorIndex) {
  const url = MIRRORS[mirrorIndex % MIRRORS.length];
  return new Promise((resolve, reject) => {
    const body = "data=" + encodeURIComponent(query);
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

function buildAreaQuery(city) {
  const name = escapeOverpassString(city);
  return `[out:json][timeout:55];
area[name="${name}"][place="city"]->.a;
(
  relation["boundary"="administrative"](area.a);
);
out body;
`;
}

function buildTownQuery(city) {
  const name = escapeOverpassString(city);
  return `[out:json][timeout:55];
area[name="${name}"][place="town"]->.a;
(
  relation["boundary"="administrative"](area.a);
);
out body;
`;
}

async function fetchCity(city) {
  let data;
  try {
    data = await overpassWithRetry(buildAreaQuery(city));
  } catch {
    data = { elements: [] };
  }
  let list = parseNames(data.elements);
  if (list.length) return list;

  try {
    data = await overpassWithRetry(buildTownQuery(city));
  } catch {
    data = { elements: [] };
  }
  list = parseNames(data.elements);
  if (list.length) return list;

  /** Не используем around(lat,lon): для пригородов подтягиваются границы соседних мегаполисов (напр. Москвы). */

  return [];
}

async function main() {
  const args = process.argv.slice(2);
  let limit = Infinity;
  let offset = 0;
  let force = false;
  for (const a of args) {
    if (a.startsWith("--limit=")) limit = parseInt(a.slice(8), 10) || Infinity;
    if (a.startsWith("--offset=")) offset = parseInt(a.slice(9), 10) || 0;
    if (a === "--force") force = true;
  }

  const citiesPath = path.join(__dirname, "../web/src/data/russianCities.json");
  const fullPath = path.join(__dirname, "russia-cities-full.json");
  const cities = JSON.parse(fs.readFileSync(citiesPath, "utf8")).filter((c) => !SKIP.has(c));
  const full = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  const byName = new Map();
  for (const x of full) byName.set(x.name, x);

  const slice = cities.slice(offset, offset + limit);
  const isFullRun = offset === 0 && slice.length === cities.length;

  const outPath = path.join(__dirname, "city-rayons-osm.json");
  let existing = {};
  if (fs.existsSync(outPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
    } catch {
      existing = {};
    }
  }
  if (force && isFullRun) {
    existing = {};
  }

  if (force && isFullRun) console.log("--force: full rebuild, ignoring merged city-rayons-osm.json");
  else if (force && !isFullRun) console.log("--force with --offset/--limit: merging into existing file on disk");
  console.log("Cities to process:", slice.length, "cached:", Object.keys(existing).length);

  let newCount = 0;

  for (const city of slice) {
    if (existing[city]?.length) continue;
    const pop = byName.get(city)?.population ?? 0;
    if (pop < MIN_POPULATION_FOR_OVERPASS) {
      existing[city] = [`Город «${city}» (целиком)`];
      newCount++;
    }
  }
  if (newCount > 0) fs.writeFileSync(outPath, JSON.stringify(existing));
  console.log("Prefilled small cities (<" + MIN_POPULATION_FOR_OVERPASS + " pop):", newCount);

  newCount = 0;
  for (const city of slice) {
    if (existing[city]?.length) continue;
    const pop = byName.get(city)?.population ?? 0;
    if (pop < MIN_POPULATION_FOR_OVERPASS) continue;

    process.stderr.write(`\r${city} …                    `);
    const rayons = await fetchCity(city);
    existing[city] = rayons.length ? rayons : [`Город «${city}» (целиком)`];
    newCount++;
    fs.writeFileSync(outPath, JSON.stringify(existing));
    await sleep(SLEEP_MS);
  }

  console.log("\nWrote", outPath, "total cities", Object.keys(existing).length, "Overpass new:", newCount);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
