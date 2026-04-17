/**
 * Geneso environment / install sanity check.
 * Usage: node scripts/geneso-doctor.mjs [--deploy] [--web] [--strict]
 *   --deploy  only contract deploy readiness
 *   --web     only nft-web readiness
 *   (default) both sections
 *   --strict  exit 1 if there are any warnings or errors (CI-friendly)
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contractsEnv = join(root, "contracts", ".env");
const nftWebEnv = join(root, "nft-web", ".env");

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");

const onlyDeploy = args.has("--deploy");
const onlyWeb = args.has("--web");
const showDeploy = !onlyWeb || onlyDeploy;
const showWeb = !onlyDeploy || onlyWeb;

function loadEnv(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  const out = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const ZERO = "0x0000000000000000000000000000000000000000";

function isEthAddress(v) {
  return typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v);
}

function isNonZeroAddress(v) {
  return isEthAddress(v) && v.toLowerCase() !== ZERO;
}

function isPlaceholderPrivateKey(v) {
  if (!v || typeof v !== "string") return true;
  const s = v.trim().toLowerCase();
  if (s.length < 10) return true;
  if (s.includes("your_private_key")) return true;
  if (s === "0x" || s === "0x0") return true;
  if (!/^0x[a-fA-F0-9]+$/.test(s)) return true;
  if (s.length !== 66) return true;
  return false;
}

function dirHasNodeModules(rel) {
  return existsSync(join(root, rel, "node_modules"));
}

const issues = { error: [], warn: [] };

function err(msg) {
  issues.error.push(msg);
}
function warn(msg) {
  issues.warn.push(msg);
}

console.log("Geneso doctor\n");

if (showDeploy) {
  console.log("- Contracts (deploy to Base mainnet) -\n");
  if (!existsSync(contractsEnv)) {
    err(`Missing ${contractsEnv} (copy contracts/.env.example)`);
  } else {
    const e = loadEnv(contractsEnv);
    if (!e.BASE_MAINNET_RPC_URL?.trim()) {
      warn("BASE_MAINNET_RPC_URL is empty (set a reliable RPC for mainnet deploy)");
    }
    if (isPlaceholderPrivateKey(e.DEPLOYER_PRIVATE_KEY)) {
      err("DEPLOYER_PRIVATE_KEY missing or still a placeholder");
    }
    if (!isNonZeroAddress(e.FEE_RECIPIENT)) {
      err("FEE_RECIPIENT must be a valid non-zero address");
    }
    if (e.PLATFORM_FEE_BPS !== undefined && e.PLATFORM_FEE_BPS !== "") {
      const n = Number(e.PLATFORM_FEE_BPS);
      if (!Number.isFinite(n) || n < 0 || n > 1000) {
        warn("PLATFORM_FEE_BPS should be 0-1000 (marketplace max is 10%)");
      }
    }
  }
  if (!dirHasNodeModules("contracts")) {
    warn("contracts/node_modules missing - run: npm run geneso:contracts:install");
  }
  console.log("");
}

if (showWeb) {
  console.log("- nft-web (local / Vercel) -\n");
  if (!existsSync(nftWebEnv)) {
    err(`Missing ${nftWebEnv} (copy nft-web/.env.example)`);
  } else {
    const e = loadEnv(nftWebEnv);
    const mp = e.VITE_MARKETPLACE_ADDRESS?.trim();
    const col = e.VITE_NFT_COLLECTION_ADDRESS?.trim();
    if (!isNonZeroAddress(mp)) {
      err("VITE_MARKETPLACE_ADDRESS missing, zero, or not a valid address");
    } else if (/yourmarketplace/i.test(mp)) {
      err("VITE_MARKETPLACE_ADDRESS still looks like a placeholder");
    }
    if (!isNonZeroAddress(col)) {
      err("VITE_NFT_COLLECTION_ADDRESS missing, zero, or not a valid address");
    } else if (/yournftcollection/i.test(col)) {
      err("VITE_NFT_COLLECTION_ADDRESS still looks like a placeholder");
    }
    if (!e.VITE_WALLETCONNECT_PROJECT_ID?.trim()) {
      warn("VITE_WALLETCONNECT_PROJECT_ID unset (WalletConnect QR optional)");
    }
  }
  if (!dirHasNodeModules("nft-web")) {
    warn("nft-web/node_modules missing - run: npm run geneso:web:install");
  }
  console.log("");
}

for (const w of issues.warn) {
  console.log(`[WARN] ${w}`);
}
for (const e of issues.error) {
  console.log(`[ERROR] ${e}`);
}

if (issues.warn.length === 0 && issues.error.length === 0) {
  console.log("[OK] All selected checks passed.\n");
  process.exit(0);
}

if (issues.error.length === 0) {
  if (strict && issues.warn.length > 0) {
    console.log("[FAIL] Strict mode: fix warnings or use default doctor (no --strict).\n");
    process.exit(1);
  }
  console.log("[OK] No blocking issues (warnings only).\n");
  process.exit(0);
}

console.log(`\n[FAIL] ${issues.error.length} blocking issue(s).\n`);
process.exit(1);
