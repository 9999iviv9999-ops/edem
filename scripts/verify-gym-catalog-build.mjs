#!/usr/bin/env node
/**
 * CI/локально: в собранном dist/lib/gym-catalog.js должны быть все «расширенные» сети ЭДЕМ,
 * иначе легко выкатить образ, где API отдаёт только DDX+World Class+X-Fit.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distPath = path.join(root, "dist", "lib", "gym-catalog.js");

const MUST_CONTAIN = [
  "Citrus Fitness",
  "Alex Fitness",
  "Fitness House",
  "МетроФитнес",
  "Profilaktika",
  "Носорог",
  "Колизей"
];

function main() {
  if (!fs.existsSync(distPath)) {
    console.error(`verify-gym-catalog-build: missing ${distPath} — run npm run build first`);
    process.exit(1);
  }
  const text = fs.readFileSync(distPath, "utf8");
  const missing = MUST_CONTAIN.filter((s) => !text.includes(s));
  if (missing.length) {
    console.error(
      `verify-gym-catalog-build: dist/lib/gym-catalog.js missing strings: ${missing.join(", ")}. Rebuild API from current src/lib/gym-catalog.ts.`
    );
    process.exit(1);
  }
  console.log("verify-gym-catalog-build: OK");
}

main();
