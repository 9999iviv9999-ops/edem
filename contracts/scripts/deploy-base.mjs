import "dotenv/config";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ContractFactory, JsonRpcProvider, Wallet, getAddress } from "ethers";

const NETWORK = "base";

async function main() {
  const rpcUrl = process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org";
  const pk = process.env.DEPLOYER_PRIVATE_KEY?.trim();
  if (!pk?.startsWith("0x") || pk.length < 66) {
    throw new Error("DEPLOYER_PRIVATE_KEY missing or invalid in contracts/.env");
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(pk, provider);
  const deployer = getAddress(wallet.address);

  const feeRecipientRaw = process.env.FEE_RECIPIENT?.trim();
  const feeRecipient =
    feeRecipientRaw && /^0x[0-9a-fA-F]{40}$/.test(feeRecipientRaw)
      ? getAddress(feeRecipientRaw)
      : deployer;

  const platformFeeBps = Number(process.env.PLATFORM_FEE_BPS || "250");
  const nftName = process.env.NFT_NAME || "Geneso Genesis";
  const nftSymbol = process.env.NFT_SYMBOL || "GENESO";

  if (!Number.isFinite(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > 1000) {
    throw new Error("PLATFORM_FEE_BPS must be in [0..1000].");
  }

  const { chainId } = await provider.getNetwork();

  console.log("Deploying with:", deployer);
  console.log("Network:", NETWORK, "chainId:", chainId.toString());

  const genesisPath = join(process.cwd(), "artifacts/src/GenesoGenesis721.sol/GenesoGenesis721.json");
  const marketPath = join(process.cwd(), "artifacts/src/GenesoMarketplace.sol/GenesoMarketplace.json");
  const genesisArtifact = JSON.parse(readFileSync(genesisPath, "utf8"));
  const marketArtifact = JSON.parse(readFileSync(marketPath, "utf8"));

  const genesisFactory = new ContractFactory(genesisArtifact.abi, genesisArtifact.bytecode, wallet);
  const genesis = await genesisFactory.deploy(deployer, nftName, nftSymbol);
  await genesis.waitForDeployment();
  const genesisAddress = await genesis.getAddress();

  // Avoid "replacement fee too low" if the RPC retries the 2nd tx too aggressively.
  await new Promise((r) => setTimeout(r, 4000));

  const marketFactory = new ContractFactory(marketArtifact.abi, marketArtifact.bytecode, wallet);
  const marketplace = await marketFactory.deploy(deployer, feeRecipient, platformFeeBps);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();

  const deployment = {
    network: NETWORK,
    chainId: Number(chainId),
    deployer,
    nftCollection: genesisAddress,
    marketplace: marketplaceAddress,
    feeRecipient,
    platformFeeBps,
    deployedAt: new Date().toISOString(),
  };

  const outDir = join(process.cwd(), "deployments");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${NETWORK}.json`);
  writeFileSync(outPath, `${JSON.stringify(deployment, null, 2)}\n`, "utf-8");

  console.log("NFT:", genesisAddress);
  console.log("Marketplace:", marketplaceAddress);
  console.log("Deployment file:", outPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
