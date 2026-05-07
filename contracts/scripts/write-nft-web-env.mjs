import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractsRoot = join(__dirname, "..");
const deploymentPath = join(contractsRoot, "deployments/ethereum.json");
const nftWebEnvPath = join(contractsRoot, "..", "nft-web", ".env.geneso");

function main() {
  if (!existsSync(deploymentPath)) {
    console.error("Missing", deploymentPath);
    console.error("Run: npm run deploy:ethereum");
    process.exit(1);
  }

  const dep = JSON.parse(readFileSync(deploymentPath, "utf8"));

  if (dep.network !== "ethereum" || dep.chainId !== 1) {
    console.error("Expected deployments/ethereum.json with network ethereum and chainId 1, got:", dep.network, dep.chainId);
    process.exit(1);
  }

  const marketplace = dep.marketplace?.trim();
  const collection = dep.nftCollection?.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(marketplace) || !/^0x[0-9a-fA-F]{40}$/.test(collection)) {
    console.error("Invalid marketplace or nftCollection in deployment file.");
    process.exit(1);
  }

  const lines = [
    "# Generated from contracts/deployments/ethereum.json — merge into nft-web/.env",
    "# Regenerate: cd contracts && npm run sync:nft-web-env",
    "",
    `VITE_MARKETPLACE_ADDRESS=${marketplace}`,
    `VITE_NFT_COLLECTION_ADDRESS=${collection}`,
    "",
  ];

  writeFileSync(nftWebEnvPath, lines.join("\n"), "utf8");
  console.log("Wrote", nftWebEnvPath);
  console.log("Next: copy lines into nft-web/.env or: cat nft-web/.env.geneso >> nft-web/.env");
}

main();
