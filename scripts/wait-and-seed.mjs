/**
 * Ждёт, пока на DATABASE_URL (по умолчанию localhost:5432) откроется TCP,
 * затем: prisma migrate deploy && prisma db seed.
 *
 * Запуск из корня репозитория (после docker compose up -d db или запуска Postgres):
 *   node scripts/wait-and-seed.mjs
 * С принудительной перезаливкой seed-*:
 *   FORCE_GYM_SEED=1 node scripts/wait-and-seed.mjs
 *
 * Таймаут ожидания (мс):  WAIT_DB_MS=180000 node scripts/wait-and-seed.mjs
 */
import net from "node:net";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
config({ path: path.join(root, ".env") });

const WAIT_MS = parseInt(process.env.WAIT_DB_MS || "180000", 10) || 180000;

function parseHostPort(url) {
  try {
    const u = new URL(url.replace(/^postgresql:/, "http:"));
    return { host: u.hostname || "localhost", port: parseInt(u.port || "5432", 10) || 5432 };
  } catch {
    return { host: "localhost", port: 5432 };
  }
}

function waitPort(host, port, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    let settled = false;
    function attempt() {
      const socket = net.createConnection({ host, port, timeout: 5000 }, () => {
        socket.end();
        if (!settled) {
          settled = true;
          resolve();
        }
      });
      socket.on("error", () => {
        socket.destroy();
        if (settled) return;
        if (Date.now() - start >= timeoutMs) {
          settled = true;
          reject(new Error(`Timeout ${timeoutMs}ms: ${host}:${port} не открылся. Запустите Postgres (docker compose up -d db).`));
        } else {
          setTimeout(attempt, 1000);
        }
      });
    }
    attempt();
  });
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Нет DATABASE_URL. Скопируйте .env.example в .env");
  process.exit(1);
}

try {
  const { host, port } = parseHostPort(dbUrl);
  console.log(`Ожидание ${host}:${port} (до ${WAIT_MS / 1000} с)…`);
  await waitPort(host, port, WAIT_MS);
  console.log("База доступна. migrate deploy…");
  execSync("npx prisma migrate deploy", { stdio: "inherit", cwd: root });

  console.log("db seed…");
  execSync("npx prisma db seed", { stdio: "inherit", cwd: root });
  console.log("Готово.");
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
