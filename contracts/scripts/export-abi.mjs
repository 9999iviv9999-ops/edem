import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const contractsDir = process.cwd();
const rootDir = join(contractsDir, "..");
const webDir = join(rootDir, "web");
const nftWebDir = join(rootDir, "nft-web");

function readArtifact(contractName) {
  const artifactPath = join(
    contractsDir,
    "artifacts",
    "src",
    `${contractName}.sol`,
    `${contractName}.json`
  );
  return JSON.parse(readFileSync(artifactPath, "utf-8"));
}

function readDeployment() {
  const prefer = process.env.GENESO_DEPLOYMENT_NETWORK;
  const order = prefer ? [prefer] : ["ethereum", "base"];
  for (const name of order) {
    const deploymentPath = join(contractsDir, "deployments", `${name}.json`);
    if (existsSync(deploymentPath)) {
      return JSON.parse(readFileSync(deploymentPath, "utf-8"));
    }
  }
  return null;
}

function main() {
  const marketplaceArtifact = readArtifact("GenesoMarketplace");
  const genesisArtifact = readArtifact("GenesoGenesis721");
  const deployment = readDeployment();

  const frontends = [nftWebDir];
  if (existsSync(join(webDir, "src", "web3"))) {
    frontends.push(webDir);
  }

  for (const root of frontends) {
    const abiDir = join(root, "src", "web3", "abis", "generated");
    mkdirSync(abiDir, { recursive: true });
    writeFileSync(
      join(abiDir, "genesoMarketplaceAbi.json"),
      `${JSON.stringify(marketplaceArtifact.abi, null, 2)}\n`,
      "utf-8"
    );
    writeFileSync(
      join(abiDir, "genesoGenesis721Abi.json"),
      `${JSON.stringify(genesisArtifact.abi, null, 2)}\n`,
      "utf-8"
    );
  }

  if (deployment?.network) {
    const outName = `${deployment.network}.json`;
    for (const root of frontends) {
      const deploymentsDir = join(root, "src", "web3", "deployments");
      mkdirSync(deploymentsDir, { recursive: true });
      writeFileSync(
        join(deploymentsDir, outName),
        `${JSON.stringify(deployment, null, 2)}\n`,
        "utf-8"
      );
    }
  }

  console.log("ABI export complete.");
}

main();
