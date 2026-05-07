import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, http, parseAbiItem } from "viem";
import { base, mainnet } from "viem/chains";

function resolveDeployment() {
  const prefer = process.env.GENESO_DEPLOYMENT_NETWORK;
  const order = prefer ? [prefer] : ["ethereum", "base"];
  for (const n of order) {
    const p = join(process.cwd(), "deployments", `${n}.json`);
    if (existsSync(p)) {
      return { network: n, deployment: JSON.parse(readFileSync(p, "utf-8")), path: p };
    }
  }
  throw new Error("Missing deployments/ethereum.json or deployments/base.json");
}

const { network, deployment } = resolveDeployment();
const marketplaceAddress = deployment.marketplace;

const rpcByNetwork = {
  ethereum: process.env.ETH_MAINNET_RPC_URL || "https://ethereum.publicnode.com",
  base: process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org",
};
const chain = network === "base" ? base : mainnet;
const rpc = rpcByNetwork[network] || rpcByNetwork.ethereum;

const outPath = join(process.cwd(), "deployments", `${network}-events.json`);

const client = createPublicClient({
  chain,
  transport: http(rpc),
});

const listingCreatedEvent = parseAbiItem(
  "event ListingCreated(uint256 indexed listingId, address indexed seller, address indexed nft, uint256 tokenId, uint256 price)"
);
const listingBoughtEvent = parseAbiItem(
  "event ListingBought(uint256 indexed listingId, address indexed buyer, uint256 amount)"
);
const bidPlacedEvent = parseAbiItem(
  "event BidPlaced(uint256 indexed listingId, address indexed bidder, uint256 amount, uint64 expiresAt)"
);
const bidAcceptedEvent = parseAbiItem(
  "event BidAccepted(uint256 indexed listingId, address indexed seller, address indexed bidder, uint256 amount)"
);

async function main() {
  const fromBlock = 0n;
  const toBlock = await client.getBlockNumber();

  const [created, bought, bids, accepted] = await Promise.all([
    client.getLogs({ address: marketplaceAddress, event: listingCreatedEvent, fromBlock, toBlock }),
    client.getLogs({ address: marketplaceAddress, event: listingBoughtEvent, fromBlock, toBlock }),
    client.getLogs({ address: marketplaceAddress, event: bidPlacedEvent, fromBlock, toBlock }),
    client.getLogs({ address: marketplaceAddress, event: bidAcceptedEvent, fromBlock, toBlock }),
  ]);

  const payload = {
    network,
    marketplaceAddress,
    indexedAt: new Date().toISOString(),
    latestBlock: toBlock.toString(),
    stats: {
      listingsCreated: created.length,
      listingsBought: bought.length,
      bidsPlaced: bids.length,
      bidsAccepted: accepted.length,
    },
    events: {
      created,
      bought,
      bids,
      accepted,
    },
  };

  mkdirSync(join(process.cwd(), "deployments"), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  console.log("Events indexed:", outPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
