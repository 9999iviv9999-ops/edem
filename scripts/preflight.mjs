#!/usr/bin/env node
/**
 * Проверки перед запуском / деплоем: .env, схема Prisma, опционально docker compose config.
 *
 *   npm run preflight
 *   npm run preflight -- --compose
 *   npm run preflight:staging
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function parseArgs() {
  const args = process.argv.slice(2);
  let envFile = process.env.PREFLIGHT_ENV_FILE || ".env";
  let compose = false;
  let staging = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--compose") compose = true;
    else if (a === "--staging") {
      staging = true;
      envFile = ".env.staging";
    } else if (a === "--env-file" && args[i + 1]) envFile = args[++i];
  }
  return { envFile, compose, staging };
}

function loadEnvFileOptional(filePath) {
  const abs = resolve(process.cwd(), filePath);
  if (!existsSync(abs)) return {};
  const text = readFileSync(abs, "utf8");
  /** @type {Record<string, string>} */
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
      (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

/** Файл .env или переменные окружения (CI без файла). Env имеет приоритет над файлом. */
function mergeCoreEnv(envFile) {
  const fromFile = loadEnvFileOptional(envFile);
  const merged = {
    DATABASE_URL: process.env.DATABASE_URL || fromFile.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET || fromFile.JWT_SECRET,
    ADMIN_MODERATION_KEY: process.env.ADMIN_MODERATION_KEY || fromFile.ADMIN_MODERATION_KEY
  };
  const abs = resolve(process.cwd(), envFile);
  if (!merged.DATABASE_URL) {
    throw new Error(
      `Preflight: нет DATABASE_URL (файл ${envFile} отсутствует или пуст — создайте из примера либо задайте env, как в CI)`
    );
  }
  const label = existsSync(abs) ? envFile : `${envFile} (переменные окружения)`;
  return { merged, label, fileExists: existsSync(abs), abs };
}

const PLACEHOLDER_DB =
  /postgresql:\/\/postgres(:|@)|CHANGEME|password_here|случайн|staging_change_me|минимум_16/i;

function validateEnv(env, fileLabel) {
  const db = env.DATABASE_URL?.trim();
  if (!db) throw new Error(`Preflight (${fileLabel}): нужен DATABASE_URL`);
  if (PLACEHOLDER_DB.test(db)) {
    throw new Error(`Preflight (${fileLabel}): DATABASE_URL похож на заглушку — укажите реальные данные`);
  }
  if (!db.includes("edem_app")) {
    throw new Error(
      `Preflight (${fileLabel}): DATABASE_URL должен использовать пользователя edem_app (см. deploy-prod.sh)`
    );
  }

  const jwt = env.JWT_SECRET?.trim();
  if (!jwt || jwt.length < 16) {
    throw new Error(`Preflight (${fileLabel}): JWT_SECRET не короче 16 символов`);
  }
  if (/минимум/i.test(jwt) || /^change_me/i.test(jwt) || /^staging_jwt_at_least/i.test(jwt)) {
    throw new Error(`Preflight (${fileLabel}): JWT_SECRET похож на заглушку из примера`);
  }

  const admin = env.ADMIN_MODERATION_KEY?.trim();
  if (!admin || admin.length < 8) {
    throw new Error(`Preflight (${fileLabel}): ADMIN_MODERATION_KEY минимум 8 символов`);
  }
  if (/минимум/i.test(admin) || /^change_me/i.test(admin) || /^staging_admin/i.test(admin)) {
    throw new Error(`Preflight (${fileLabel}): ADMIN_MODERATION_KEY похож на заглушку из примера`);
  }

  console.log(`OK    ${fileLabel}: DATABASE_URL, JWT_SECRET, ADMIN_MODERATION_KEY`);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function main() {
  const { envFile, compose, staging } = parseArgs();
  const tag = `${envFile}${staging ? " (staging)" : ""}${compose ? " + compose" : ""}`;
  console.log(`Preflight: ${tag}`);

  const { merged, label, fileExists, abs } = mergeCoreEnv(envFile);
  validateEnv(merged, label);

  const prismaCli = resolve(process.cwd(), "node_modules/prisma/build/index.js");
  run(process.execPath, [prismaCli, "validate"]);
  console.log("OK    prisma validate");

  if (compose) {
    if (!fileExists) {
      throw new Error(
        `Preflight: --compose требует файл ${envFile} на диске (для docker compose --env-file). В CI preflight без --compose.`
      );
    }
    const envAbs = abs;
    const args = ["compose", "--env-file", envAbs, "-f", "docker-compose.yml"];
    if (staging) args.push("-f", "docker-compose.staging.yml");
    args.push("config", "-q");
    run("docker", args);
    console.log("OK    docker compose config");
  }

  console.log("Preflight: готово к запуску");
}

try {
  main();
} catch (e) {
  console.error(`FAIL  ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
