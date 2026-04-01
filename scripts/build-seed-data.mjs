/**
 * Reads scripts/russia-cities-full.json (download separately) and writes:
 * - web/src/data/russianCities.json — sorted unique city names
 * - prisma/gyms-generated.json — synthetic gyms: каждая сеть × каждый город РФ
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcPath = path.join(__dirname, "russia-cities-full.json");
const outCities = path.join(root, "web", "src", "data", "russianCities.json");
const outGyms = path.join(root, "prisma", "gyms-generated.json");

if (!fs.existsSync(srcPath)) {
  console.error("Missing:", srcPath);
  console.error("Download: https://raw.githubusercontent.com/arbaev/russia-cities/master/russia-cities.json");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(srcPath, "utf8"));

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
  "Дворец спорта"
];

const gyms = [];

for (const row of raw) {
  const city = row.name;
  const region = row.region?.name || "";
  const cityId = row.id;

  CHAINS.forEach((chainName, ci) => {
    gyms.push({
      name: `${chainName} ${city}`,
      address: region ? `г. ${city}, ${region}` : `г. ${city}`,
      city,
      region: region || undefined,
      chainName,
      externalProvider: "other",
      externalId: `seed-${cityId}-${ci}`
    });
  });
}

fs.writeFileSync(outGyms, JSON.stringify(gyms, null, 0), "utf8");
console.log("Wrote", gyms.length, "gyms ->", path.relative(root, outGyms));
