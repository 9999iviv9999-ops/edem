/**
 * Create or update nft-web/.env with addresses from contracts/deployments/ethereum.json.
 * Run from repo root: npm run geneso:sync-nft-env
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const deploymentPath = join(root, "contracts", "deployments", "ethereum.json");
const examplePath = join(root, "nft-web", ".env.example");
const envPath = join(root, "nft-web", ".env");

function upsertEnvLine(content, key, value) {
  const lines = content.split(/\r?\n/);
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s*${esc}\\s*=`);
  let found = false;
  const next = lines.map((line) => {
    if (re.test(line)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) {
    if (next.length && next[next.length - 1] !== "") next.push("");
    next.push(`${key}=${value}`);
  }
  return next.join("\n");
}

function main() {
  if (!existsSync(deploymentPath)) {
    console.error("[geneso-sync-nft-env] Missing", deploymentPath);
    console.error("Deploy first: npm run geneso:contracts:deploy:ethereum");
    process.exit(1);
  }

  const dep = JSON.parse(readFileSync(deploymentPath, "utf8"));
  if (dep.network !== "ethereum" || dep.chainId !== 1) {
    console.error("[geneso-sync-nft-env] Expected ethereum mainnet in deployment file, got:", dep.network, dep.chainId);
    process.exit(1);
  }

  const mp = dep.marketplace?.trim();
  const col = dep.nftCollection?.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(mp) || !/^0x[0-9a-fA-F]{40}$/.test(col)) {
    console.error("[geneso-sync-nft-env] Invalid marketplace or nftCollection in deployment.");
    process.exit(1);
  }

  if (!existsSync(examplePath)) {
    console.error("[geneso-sync-nft-env] Missing", examplePath);
    process.exit(1);
  }

  if (!existsSync(envPath)) {
    copyFileSync(examplePath, envPath);
    console.log("[geneso-sync-nft-env] Created", envPath, "from .env.example");
  }

  let body = readFileSync(envPath, "utf8");
  body = upsertEnvLine(body, "VITE_MARKETPLACE_ADDRESS", mp);
  body = upsertEnvLine(body, "VITE_NFT_COLLECTION_ADDRESS", col);
  writeFileSync(envPath, body.endsWith("\n") ? body : `${body}\n`, "utf8");

  console.log("[geneso-sync-nft-env] Updated VITE_* in", envPath);
  console.log(`  VITE_MARKETPLACE_ADDRESS=${mp}`);
  console.log(`  VITE_NFT_COLLECTION_ADDRESS=${col}`);
}

main();
