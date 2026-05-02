#!/usr/bin/env node
import process from "node:process";

const baseUrl = process.env.SMOKE_API_URL || process.env.API_URL || "http://127.0.0.1:3000";
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15000);

function withTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function getJson(path) {
  const res = await withTimeout(`${baseUrl}${path}`);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${path}: non-JSON response (${text.slice(0, 200)})`);
  }
  if (!res.ok) {
    throw new Error(`${path}: HTTP ${res.status} ${res.statusText}`);
  }
  return body;
}

function printWarn(message) {
  console.log(`WARN  ${message}`);
}

function printOk(message) {
  console.log(`OK    ${message}`);
}

async function main() {
  console.log(`ops-doctor target: ${baseUrl}`);

  const health = await getJson("/health");
  if (health?.status !== "ok") throw new Error("/health status != ok");
  printOk("API health endpoint is reachable");

  const deepHealth = await getJson("/health?deep=1");
  if (deepHealth?.db !== "ok") throw new Error("/health?deep=1 db != ok");
  if (Object.prototype.hasOwnProperty.call(deepHealth, "userModel") && deepHealth.userModel !== "ok") {
    throw new Error(`/health?deep=1 userModel=${deepHealth.userModel} (run prisma migrations)`);
  }
  printOk("DB deep health is reachable");

  const cities = await getJson("/api/gyms/cities");
  if (!Array.isArray(cities) || cities.length === 0) throw new Error("/api/gyms/cities is empty");
  printOk(`Gym cities available: ${cities.length}`);

  const missingEnvHints = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "DB_CONTAINER", "API_CONTAINER"].filter(
    (k) => !process.env[k]
  );
  if (missingEnvHints.length) {
    printWarn(`Optional env vars not set: ${missingEnvHints.join(", ")}`);
  } else {
    printOk("Optional ops env vars are set");
  }

  console.log("ops-doctor complete");
}

main().catch((err) => {
  console.error(`FAIL  ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
