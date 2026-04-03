/**
 * Генерирует web/src/data/cityDivisions.json:
 * — Москва: адм. округа + все 132 района (из scripts/moscow-parsed.json)
 * — СПб, Казань, Екатеринбург, Новосибирск: внутригородские районы
 * — остальные 1078 городов: субъект РФ как «округ», условные зоны как «район»
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GENERIC_RAYONS = ["Весь город", "Центр", "Окраины", "Пригород"];

const MAJOR = {
  "Санкт-Петербург": {
    okrugs: [
      {
        name: "Санкт-Петербург",
        rayons: [
          "Адмиралтейский район",
          "Василеостровский район",
          "Выборгский район",
          "Калининский район",
          "Кировский район",
          "Колпинский район",
          "Красногвардейский район",
          "Красносельский район",
          "Кронштадтский район",
          "Курортный район",
          "Московский район",
          "Невский район",
          "Петроградский район",
          "Петродворцовый район",
          "Приморский район",
          "Пушкинский район",
          "Фрунзенский район",
          "Центральный район"
        ]
      }
    ]
  },
  Казань: {
    okrugs: [
      {
        name: "Казань",
        rayons: [
          "Вахитовский район",
          "Авиастроительный район",
          "Кировский район",
          "Московский район",
          "Ново-Савиновский район",
          "Приволжский район",
          "Советский район"
        ]
      }
    ]
  },
  Екатеринбург: {
    okrugs: [
      {
        name: "Екатеринбург",
        rayons: [
          "Верх-Исетский район",
          "Железнодорожный район",
          "Кировский район",
          "Ленинский район",
          "Октябрьский район",
          "Орджоникидзевский район",
          "Чкаловский район"
        ]
      }
    ]
  },
  Новосибирск: {
    okrugs: [
      {
        name: "Новосибирск",
        rayons: [
          "Дзержинский район",
          "Железнодорожный район",
          "Заельцовский район",
          "Калининский район",
          "Кировский район",
          "Ленинский район",
          "Октябрьский район",
          "Первомайский район",
          "Советский район",
          "Центральный район"
        ]
      }
    ]
  }
};

function main() {
  const moscow = JSON.parse(fs.readFileSync(path.join(__dirname, "moscow-parsed.json"), "utf8"));
  const cities = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../web/src/data/russianCities.json"), "utf8")
  );
  const full = JSON.parse(fs.readFileSync(path.join(__dirname, "russia-cities-full.json"), "utf8"));
  const byName = new Map();
  for (const x of full) byName.set(x.name, x);

  /** @type {Record<string, { okrugs: { name: string; rayons: string[] }[] }>} */
  const out = {};

  for (const city of cities) {
    if (city === "Москва") {
      out[city] = moscow;
      continue;
    }
    if (MAJOR[city]) {
      out[city] = MAJOR[city];
      continue;
    }
    const row = byName.get(city);
    const subject = row?.region?.name || "Россия";
    out[city] = {
      okrugs: [
        {
          name: subject,
          rayons: [...GENERIC_RAYONS]
        }
      ]
    };
  }

  const outPath = path.join(__dirname, "../web/src/data/cityDivisions.json");
  fs.writeFileSync(outPath, JSON.stringify(out));
  console.log("Wrote", outPath, "cities", Object.keys(out).length);
}

main();
