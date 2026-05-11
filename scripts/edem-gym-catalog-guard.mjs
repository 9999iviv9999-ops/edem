#!/usr/bin/env node
/**
 * Защита от «старого» gym-catalog в API: в БД залы есть, а белый список режет локальные сети.
 * Проверяет публичный GET /api/gyms для Челябинска (не требует авторизации).
 *
 * Использование:
 *   SMOKE_API_URL=https://edem.press node scripts/edem-gym-catalog-guard.mjs
 *   SMOKE_SKIP_CATALOG_GUARD=1 — отключить (стенд без полного импорта).
 */
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const CHELYABINSK = "Челябинск";
/** Минимум залов при полном импорте DDX+сети+локальные (ниже порога — тревога). */
const MIN_GYMS = 20;
/** Префиксы chainName, которые есть только при полном whitelist (не в урезанном DDX+WC+XFit). */
const REQUIRED_CHAIN_PREFIXES = ["Alex Fitness", "Citrus Fitness", "МетроФитнес", "DDX"];

function withTimeout(url, init = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function expectJson(baseUrl, path, timeoutMs) {
  const res = await withTimeout(`${baseUrl}${path}`, {}, timeoutMs);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${path}: not JSON (${text.slice(0, 200)})`);
  }
  if (!res.ok) {
    throw new Error(`${path}: HTTP ${res.status} (${JSON.stringify(body).slice(0, 200)})`);
  }
  return body;
}

function chainMatchesPrefix(chainName, prefix) {
  const c = String(chainName || "").trim();
  const p = String(prefix).trim();
  if (p === "DDX") return c.startsWith("DDX");
  return c.startsWith(p);
}

/**
 * @param {string} baseUrl
 * @param {number} timeoutMs
 */
export async function assertProdlikeGymCatalog(baseUrl, timeoutMs = 20000) {
  const path = `/api/gyms?city=${encodeURIComponent(CHELYABINSK)}&limit=5000`;
  const gyms = await expectJson(baseUrl.replace(/\/$/, ""), path, timeoutMs);
  if (!Array.isArray(gyms)) {
    throw new Error(`gym catalog guard: ${path} expected array`);
  }
  if (gyms.length < MIN_GYMS) {
    throw new Error(
      `gym catalog guard: Челябинск expected >= ${MIN_GYMS} gyms (full catalog), got ${gyms.length}. ` +
        `Часто причина — в контейнере API старый dist/lib/gym-catalog.js; сделайте docker compose build api && up -d api из актуального репо.`
    );
  }
  const missing = [];
  for (const prefix of REQUIRED_CHAIN_PREFIXES) {
    if (!gyms.some((g) => chainMatchesPrefix(g.chainName, prefix))) {
      missing.push(prefix);
    }
  }
  if (missing.length) {
    const sample = [...new Set(gyms.map((g) => g.chainName).filter(Boolean))].slice(0, 15);
    throw new Error(
      `gym catalog guard: в Челябинске нет залов с chainName для: ${missing.join(", ")}. ` +
        `Уникальные сети в выборке (фрагмент): ${sample.join("; ") || "(пусто)"}. ` +
        `Проверьте src/lib/gym-catalog.ts и пересоберите образ API.`
    );
  }
}

async function main() {
  const baseUrl = (process.env.SMOKE_API_URL || process.env.API_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
  const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 20000);
  await assertProdlikeGymCatalog(baseUrl, timeoutMs);
  console.log(`EDEM gym catalog guard OK (${CHELYABINSK}, chains: ${REQUIRED_CHAIN_PREFIXES.join(", ")})`);
}

const isDirectRun =
  process.argv[1] &&
  path.normalize(fileURLToPath(import.meta.url)) === path.normalize(process.argv[1]);
if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
