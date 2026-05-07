import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ContractFactory, JsonRpcProvider, Wallet, getAddress } from "ethers";

function resolveDeploymentPath() {
  const prefer = process.env.GENESO_DEPLOYMENT_NETWORK;
  const order = prefer ? [prefer] : ["ethereum", "base"];
  for (const n of order) {
    const p = join(process.cwd(), "deployments", `${n}.json`);
    if (existsSync(p)) {
      return p;
    }
  }
  throw new Error("Missing deployments/ethereum.json or deployments/base.json");
}

const rpcByNetwork = {
  ethereum: process.env.ETH_MAINNET_RPC_URL || "https://ethereum.publicnode.com",
  base: process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org",
};

/**
 * Deploy only GenesoMarketplace when Genesis721 already exists.
 * Uses deployments/{ethereum|base}.json (see GENESO_DEPLOYMENT_NETWORK).
 */
async function main() {
  const deploymentPath = resolveDeploymentPath();

  const pk = process.env.DEPLOYER_PRIVATE_KEY?.trim();
  if (!pk?.startsWith("0x") || pk.length < 66) {
    throw new Error("DEPLOYER_PRIVATE_KEY missing or invalid in contracts/.env");
  }

  const existing = JSON.parse(readFileSync(deploymentPath, "utf8"));
  const network = existing.network === "base" ? "base" : "ethereum";
  const rpcUrl = rpcByNetwork[network];
  const deployer = getAddress(existing.deployer);
  if (getAddress(new Wallet(pk).address) !== deployer) {
    throw new Error("DEPLOYER_PRIVATE_KEY does not match deployment file deployer");
  }

  const feeRecipientRaw = process.env.FEE_RECIPIENT?.trim();
  const feeRecipient =
    feeRecipientRaw && /^0x[0-9a-fA-F]{40}$/.test(feeRecipientRaw)
      ? getAddress(feeRecipientRaw)
      : getAddress(existing.feeRecipient || deployer);

  const platformFeeBps = Number(process.env.PLATFORM_FEE_BPS || existing.platformFeeBps || "250");
  if (!Number.isFinite(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > 1000) {
    throw new Error("PLATFORM_FEE_BPS must be in [0..1000].");
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(pk, provider);

  const marketPath = join(process.cwd(), "artifacts/src/GenesoMarketplace.sol/GenesoMarketplace.json");
  const marketArtifact = JSON.parse(readFileSync(marketPath, "utf8"));
  const factory = new ContractFactory(marketArtifact.abi, marketArtifact.bytecode, wallet);

  console.log("Network:", network, "Deploying GenesoMarketplace with owner", deployer, "feeRecipient", feeRecipient, "bps", platformFeeBps);
  const marketplace = await factory.deploy(deployer, feeRecipient, platformFeeBps);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();

  const next = {
    ...existing,
    marketplace: marketplaceAddress,
    feeRecipient,
    platformFeeBps,
    deployedAt: new Date().toISOString(),
  };
  writeFileSync(deploymentPath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");

  console.log("Marketplace:", marketplaceAddress);
  console.log("Updated", deploymentPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
