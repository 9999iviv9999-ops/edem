/**
 * Пошаговая выгрузка залов из OSM: по одному запросу на район (Москва) или на город (остальное),
 * с паузой между шагами и файлом прогресса (можно прервать и продолжить).
 *
 * Пишет в ту же таблицу Gym, что и fetch-gyms-osm.mjs — лента и профиль подхватывают через GET /api/gyms.
 *
 * Usage:
 *   node scripts/fetch-gyms-batch.mjs --scope=moscow --sleep-ms=2500
 *   node scripts/fetch-gyms-batch.mjs --scope=cities --from=0 --to=30 --sleep-ms=3000
 *   node scripts/fetch-gyms-batch.mjs --scope=both --from=0 --to=20 --sleep-ms=3000
 *   node scripts/fetch-gyms-batch.mjs --scope=moscow --dry-run
 *   node scripts/fetch-gyms-batch.mjs --scope=moscow --reset-progress   (сбросить прогресс и заново)
 *
 * Env: DATABASE_URL, как у fetch-gyms-osm.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadMoscowPlan() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "moscow-parsed.json"), "utf8"));
}

function loadRussianCities() {
  const p = path.join(root, "web", "src", "data", "russianCities.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function parseArgs(argv) {
  const out = {
    scope: "moscow",
    sleepMs: 2000,
    progressFile: path.join(__dirname, "_fetch_gyms_batch_progress.json"),
    from: 0,
    to: null,
    dryRun: false,
    resetProgress: false
  };
  for (const a of argv) {
    if (a.startsWith("--scope=")) out.scope = a.slice(8);
    else if (a.startsWith("--sleep-ms=")) out.sleepMs = Math.max(0, parseInt(a.slice(11), 10) || 0);
    else if (a.startsWith("--progress=")) out.progressFile = a.slice(11);
    else if (a.startsWith("--from=")) out.from = Math.max(0, parseInt(a.slice(7), 10) || 0);
    else if (a.startsWith("--to=")) out.to = parseInt(a.slice(5), 10);
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--reset-progress") out.resetProgress = true;
  }
  return out;
}

function loadProgress(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    return new Set(Array.isArray(j.done) ? j.done : []);
  } catch {
    return new Set();
  }
}

function saveProgress(file, done) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ done: [...done].sort(), updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

function runFetchGymsOsm(args, dryRun) {
  const script = path.join(__dirname, "fetch-gyms-osm.mjs");
  const full = ["node", script, ...args];
  if (dryRun) {
    console.log("[dry-run]", full.map((x) => (/\s/.test(x) ? `"${x}"` : x)).join(" "));
    return Promise.resolve(0);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: root,
      stdio: "inherit",
      env: process.env
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(code);
      else reject(new Error(`fetch-gyms-osm exited with ${code}`));
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let done = new Set();
  if (args.resetProgress) {
    if (fs.existsSync(args.progressFile)) fs.unlinkSync(args.progressFile);
    console.log("Прогресс сброшен:", args.progressFile);
  } else {
    done = loadProgress(args.progressFile);
  }
  const scopes = args.scope === "both" ? ["moscow", "cities"] : [args.scope];

  /** @type {{ key: string; argv: string[] }[]} */
  const queue = [];

  if (scopes.includes("moscow")) {
    const plan = loadMoscowPlan();
    for (const o of plan.okrugs || []) {
      const okrug = o.name;
      for (const rayon of o.rayons || []) {
        const key = `moscow:${okrug}:${rayon}`;
        queue.push({
          key,
          argv: ["--city=Москва", `--district=${rayon}`, "--sleep=0"]
        });
      }
    }
  }

  if (scopes.includes("cities")) {
    const cities = loadRussianCities();
    const to = args.to != null && !Number.isNaN(args.to) ? args.to : cities.length;
    const slice = cities.slice(args.from, to);
    for (const city of slice) {
      if (city === "Москва") continue;
      const key = `city:${city}`;
      queue.push({
        key,
        argv: ["--city=" + city, "--sleep=0"]
      });
    }
  }

  const pending = queue.filter((j) => !done.has(j.key));
  console.log(
    "Jobs total:",
    queue.length,
    "| already done:",
    queue.length - pending.length,
    "| to run:",
    pending.length,
    "| sleep between:",
    args.sleepMs,
    "ms"
  );

  for (let i = 0; i < pending.length; i++) {
    const job = pending[i];
    console.log(`\n[${i + 1}/${pending.length}] ${job.key}`);
    try {
      await runFetchGymsOsm(job.argv, args.dryRun);
      if (!args.dryRun) {
        done.add(job.key);
        saveProgress(args.progressFile, done);
      }
    } catch (e) {
      console.error("Остановка на ошибке:", job.key, e.message || e);
      console.error("Исправьте проблему и запустите снова — выполненные шаги уже в progress.");
      process.exit(1);
    }
    if (i < pending.length - 1 && args.sleepMs > 0) await sleep(args.sleepMs);
  }

  console.log("\nГотово. Данные в БД Gym — лента и профиль используют /api/gyms.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
