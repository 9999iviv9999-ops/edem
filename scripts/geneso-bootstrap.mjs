/**
 * One-shot Geneso setup: install deps, compile contracts, smoke test, build web.
 * Run from repo root: npm run geneso:bootstrap
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(label, command) {
  console.log(`\n==> ${label}\n`);
  execSync(command, { stdio: "inherit", cwd: root, env: process.env });
}

try {
  run("Install contracts dependencies", "npm run geneso:contracts:install");
  run("Install nft-web dependencies", "npm run geneso:web:install");
  run("Compile contracts", "npm run geneso:contracts:compile");
  run("Contract smoke test", "npm run geneso:contracts:test");
  try {
    run("Sync nft-web/.env from deployments/ethereum.json", "npm run geneso:sync-nft-env");
  } catch {
    console.warn(
      "\n[WARN] Could not sync nft-web/.env (missing contracts/deployments/ethereum.json?). Copy nft-web/.env.example and set VITE_* manually.\n"
    );
  }
  run("Build nft-web", "npm run geneso:web:build");
  console.log(
    "\n[OK] Geneso bootstrap finished.\n    Run UI: npm run geneso:web:dev\n    Sanity: npm run geneso:doctor\n    Deploy new contracts: copy contracts/.env.example → contracts/.env, then npm run geneso:contracts:deploy:ethereum && npm run geneso:contracts:export:abi && npm run geneso:sync-nft-env\n"
  );
} catch {
  process.exit(1);
}
