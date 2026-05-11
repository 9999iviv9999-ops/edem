#!/usr/bin/env node
import { assertProdlikeGymCatalog } from "./edem-gym-catalog-guard.mjs";
import process from "node:process";

const baseUrl = (process.env.SMOKE_API_URL || process.env.API_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 20000);
/** Регистрация в смоуке создаёт мусор в User. На проде по умолчанию выключено. Включить: SMOKE_REGISTER=1 */
const doRegister = process.env.SMOKE_REGISTER === "1" || process.env.SMOKE_REGISTER === "true";
/** Отключить проверку полного каталога (Челябинск): стенд без импортов — SMOKE_SKIP_CATALOG_GUARD=1 */
const skipCatalogGuard =
  process.env.SMOKE_SKIP_CATALOG_GUARD === "1" || process.env.SMOKE_SKIP_CATALOG_GUARD === "true";

function withTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function expectJson(path, init) {
  const res = await withTimeout(`${baseUrl}${path}`, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${path}: response is not JSON (${text.slice(0, 200)})`);
  }
  if (!res.ok) {
    throw new Error(`${path}: HTTP ${res.status} ${res.statusText} (${JSON.stringify(body).slice(0, 200)})`);
  }
  return body;
}

async function main() {
  const checks = [];

  const health = await expectJson("/health");
  checks.push(`health=${health?.status || "unknown"}`);

  const healthDeep = await expectJson("/health?deep=1");
  if (healthDeep?.db !== "ok") {
    throw new Error(`/health?deep=1: expected db ok, got ${JSON.stringify(healthDeep)}`);
  }
  if (Object.prototype.hasOwnProperty.call(healthDeep, "userModel") && healthDeep.userModel !== "ok") {
    throw new Error(
      `/health?deep=1: Prisma User table out of sync (userModel=${healthDeep.userModel}). Apply migrations before release.`
    );
  }
  checks.push("db=ok");

  const cities = await expectJson("/api/gyms/cities");
  if (!Array.isArray(cities) || cities.length === 0) {
    throw new Error("/api/gyms/cities: empty or invalid list");
  }
  checks.push(`cities=${cities.length}`);

  const city = cities[0];
  const gyms = await expectJson(`/api/gyms?city=${encodeURIComponent(city)}`);
  if (!Array.isArray(gyms) || gyms.length === 0) {
    throw new Error(`/api/gyms?city=${city}: empty or invalid list`);
  }
  checks.push(`gyms_in_${city}=${gyms.length}`);

  if (!skipCatalogGuard) {
    await assertProdlikeGymCatalog(baseUrl, timeoutMs);
    checks.push("catalog_guard=ok");
  } else {
    checks.push("catalog_guard=skipped");
  }

  if (doRegister) {
    const stamp = Date.now();
    const registerPayload = {
      name: "Smoke Test User",
      email: `smoke-${stamp}@example.com`,
      phone: `+7999${String(stamp).slice(-7)}`,
      password: "smoke12345",
      age: 25,
      gender: "male",
      city,
      acceptPrivacyPolicy: true
    };
    const reg = await expectJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerPayload)
    });
    if (!reg?.accessToken || !reg?.refreshToken) {
      throw new Error("/api/auth/register: missing auth tokens");
    }
    checks.push("register=ok");
  } else {
    checks.push("register=skipped");
  }

  console.log(`SMOKE OK (${checks.join(", ")})`);
}

main().catch((err) => {
  console.error(`SMOKE FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
