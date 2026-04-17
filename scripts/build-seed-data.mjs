/**
 * Reads scripts/russia-cities-full.json (download separately) and writes:
 * - web/src/data/russianCities.json — sorted unique city names
 * - prisma/gyms-generated.json — synthetic gyms: каждая сеть × каждый город × каждый округ/район
 *   (география из web/src/data/cityDivisions.json — Москва, крупные города, остальное)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcPath = path.join(__dirname, "russia-cities-full.json");
const divisionsPath = path.join(root, "web", "src", "data", "cityDivisions.json");
const outCities = path.join(root, "web", "src", "data", "russianCities.json");
const outGyms = path.join(root, "prisma", "gyms-generated.json");

if (!fs.existsSync(srcPath)) {
  console.error("Missing:", srcPath);
  console.error("Download: https://raw.githubusercontent.com/arbaev/russia-cities/master/russia-cities.json");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(srcPath, "utf8"));

if (!fs.existsSync(divisionsPath)) {
  console.error("Missing:", divisionsPath);
  console.error("Run: node scripts/build-city-divisions.mjs");
  process.exit(1);
}
/** @type {Record<string, { okrugs: { name: string; rayons: string[] }[] }>} */
const cityDivisions = JSON.parse(fs.readFileSync(divisionsPath, "utf8"));

/**
 * @param {string} city
 * @param {string} region субъект РФ из russia-cities-full
 * @returns {{ okrug: string | null; district: string }[]}
 */
function areaPairsForCity(city, region) {
  const div = cityDivisions[city];
  const pairs = [];
  if (div?.okrugs?.length) {
    for (const o of div.okrugs) {
      const okrug = o.name?.trim() || null;
      for (const r of o.rayons || []) {
        if (r?.trim()) pairs.push({ okrug, district: r.trim() });
      }
    }
  }
  if (pairs.length) return pairs;
  const fallbackDistrict = `Город «${city}» (целиком)`;
  const okrug = region?.trim() || null;
  return [{ okrug, district: fallbackDistrict }];
}

function formatAddress(city, region, area) {
  const parts = [`г. ${city}`, area.district];
  const ok = area.okrug;
  if (ok && ok !== area.district && ok !== city) parts.push(ok);
  if (region && region !== city && region !== ok) parts.push(region);
  return parts.join(", ");
}

const names = [...new Set(raw.map((c) => c.name))].sort((a, b) => a.localeCompare(b, "ru"));
fs.mkdirSync(path.dirname(outCities), { recursive: true });
fs.writeFileSync(outCities, JSON.stringify(names, null, 0), "utf8");
console.log("Wrote", names.length, "cities ->", path.relative(root, outCities));

const CHAINS = [
  "World Class",
  "X-Fit",
  "Fitness House",
  "Alex Fitness",
  "DDX Fitness",
  "SportFamily",
  "Zebra FITNESS",
  "Neon Fitness",
  "Prime Fitness",
  "UNICUM",
  "Fitness Club R",
  "Sport Life",
  "FizKult",
  "Oxygen Fitness",
  "Maximus",
  "Gold's Gym",
  "Watson Gym",
  "Orange Fitness",
  "FitFashion",
  "Terrasport",
  "Gym24",
  "Планета Фитнес",
  "Культ тела",
  "Super Gym",
  "Iron Gym",
  "CrossFit Box",
  "Yoga Studio Pro",
  "Stretching Club",
  "Бассейн и фитнес",
  "СК «Олимп»",
  "Дворец спорта",
  "Go Fit",
  "Life Fitness Club",
  "SportLand",
  "Мегаспорт",
  "Крокус Fitness",
  "Clubsport",
  "Pilot Gym",
  "Drive Gym",
  "Athletic Arena",
  "Gorilla Gym",
  "Millennium Fitness",
  "Eclipse Gym",
  "Atmosphere",
  "Just Gym",
  "Formula Sport"
];

/** Независимые залы, студии, бассейны — отдельные точки в каждом городе */
const LOCAL_VENUES = [
  { title: "Тренажёрный зал «Сила»", kind: "Тренажёрный зал" },
  { title: "Фитнес-студия Balance", kind: "Студия" },
  { title: "Спортклуб «Энергия»", kind: "Спортклуб" },
  { title: "Студия пилатеса & stretch", kind: "Студия" },
  { title: "EMS-студия FitBody", kind: "EMS-студия" },
  { title: "Бассейн и тренажёрный комплекс", kind: "Бассейн и фитнес" },
  { title: "ДЮСШ — спортивный зал", kind: "ДЮСШ" },
  { title: "Кроссфит-арена", kind: "Кроссфит" },
  { title: "Йога-студия Shanti", kind: "Йога" },
  { title: "Тренажёрный зал 24/7", kind: "Тренажёрный зал" },
  { title: "Fight Club & Gym", kind: "Единоборства" },
  { title: "Спа-фитнес центр", kind: "Спа-фитнес" },
  { title: "Центр функционального тренинга", kind: "Функциональный тренинг" },
  { title: "Gym & Pool", kind: "Тренажёрный зал" },
  { title: "Power Train Studio", kind: "Студия" },
  { title: "Cycling Studio", kind: "Кардио-студия" },
  { title: "Rock Climbing & Fitness", kind: "Скалодром" },
  { title: "Женский фитнес-клуб", kind: "Фитнес-клуб" },
  { title: "Aero Stretch Studio", kind: "Студия" },
  { title: "Iron Pit Gym", kind: "Тренажёрный зал" }
];

const gyms = [];

for (const row of raw) {
  const city = row.name;
  const region = row.region?.name || "";
  const cityId = row.id;
  const areas = areaPairsForCity(city, region);

  areas.forEach((area, ai) => {
    const address = formatAddress(city, region, area);
    const locSuffix = `, ${city}`;

    CHAINS.forEach((chainName, ci) => {
      gyms.push({
        name: `${chainName} — ${area.district}${locSuffix}`,
        address,
        city,
        region: region || undefined,
        okrug: area.okrug ?? undefined,
        district: area.district,
        chainName,
        externalProvider: "other",
        externalId: `seed-${cityId}-a${ai}-${ci}`
      });
    });

    LOCAL_VENUES.forEach((v, li) => {
      gyms.push({
        name: `${v.title} — ${area.district}${locSuffix}`,
        address,
        city,
        region: region || undefined,
        okrug: area.okrug ?? undefined,
        district: area.district,
        chainName: v.kind,
        externalProvider: "other",
        externalId: `seed-loc-${cityId}-a${ai}-${li}`
      });
    });
  });
}

fs.writeFileSync(outGyms, JSON.stringify(gyms, null, 0), "utf8");
console.log("Wrote", gyms.length, "gyms ->", path.relative(root, outGyms));
