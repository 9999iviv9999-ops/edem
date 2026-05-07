import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();

  if (!deployer) {
    throw new Error("No deployer signer found. Check DEPLOYER_PRIVATE_KEY.");
  }

  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  const platformFeeBps = Number(process.env.PLATFORM_FEE_BPS || "250");
  const nftName = process.env.NFT_NAME || "Geneso Genesis";
  const nftSymbol = process.env.NFT_SYMBOL || "GENESO";

  if (!Number.isFinite(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > 1000) {
    throw new Error("PLATFORM_FEE_BPS must be in [0..1000].");
  }

  console.log("Deploying with:", deployer.address);
  console.log("Network:", network.name);

  const genesisFactory = await ethers.getContractFactory("GenesoGenesis721");
  const genesis = await genesisFactory.deploy(deployer.address, nftName, nftSymbol);
  await genesis.waitForDeployment();
  const genesisAddress = await genesis.getAddress();

  const marketplaceFactory = await ethers.getContractFactory("GenesoMarketplace");
  const marketplace = await marketplaceFactory.deploy(
    deployer.address,
    feeRecipient,
    platformFeeBps
  );
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();

  const deployment = {
    network: network.name,
    chainId: Number(network.config.chainId || 0),
    deployer: deployer.address,
    nftCollection: genesisAddress,
    marketplace: marketplaceAddress,
    feeRecipient,
    platformFeeBps,
    deployedAt: new Date().toISOString(),
  };

  const outDir = join(process.cwd(), "deployments");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${network.name}.json`);
  writeFileSync(outPath, `${JSON.stringify(deployment, null, 2)}\n`, "utf-8");

  console.log("NFT:", genesisAddress);
  console.log("Marketplace:", marketplaceAddress);
  console.log("Deployment file:", outPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
