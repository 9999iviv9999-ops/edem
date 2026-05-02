#!/usr/bin/env node
import process from "node:process";

const baseUrl = process.env.SMOKE_API_URL || process.env.API_URL || "http://127.0.0.1:3000";
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 20000);

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

  const stamp = Date.now();
  const registerPayload = {
    name: "Smoke Test User",
    email: `smoke-${stamp}@example.com`,
    phone: `+7999${String(stamp).slice(-7)}`,
    password: "smoke12345",
    age: 25,
    gender: "male",
    city
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

  console.log(`SMOKE OK (${checks.join(", ")})`);
}

main().catch((err) => {
  console.error(`SMOKE FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
