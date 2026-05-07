import { strict as assert } from "node:assert";
import { network } from "hardhat";

async function testBuyFlow() {
  const { ethers } = await network.connect();
  const [owner, seller, buyer, feeWallet] = await ethers.getSigners();

  const nftFactory = await ethers.getContractFactory("GenesoGenesis721");
  const nft = await nftFactory.deploy(owner.address, "Geneso", "GENESO");
  await nft.waitForDeployment();

  const marketFactory = await ethers.getContractFactory("GenesoMarketplace");
  const market = await marketFactory.deploy(owner.address, feeWallet.address, 250);
  await market.waitForDeployment();

  await nft.connect(owner).mintTo(seller.address, "ipfs://one");
  await nft.connect(seller).approve(await market.getAddress(), 1n);
  await market.connect(seller).createListing(await nft.getAddress(), 1n, ethers.parseEther("1"));

  const feeBefore = await ethers.provider.getBalance(feeWallet.address);
  await market.connect(buyer).buy(1n, { value: ethers.parseEther("1") });
  const feeAfter = await ethers.provider.getBalance(feeWallet.address);

  assert.equal(await nft.ownerOf(1n), buyer.address);
  assert.equal(feeAfter - feeBefore, ethers.parseEther("0.025"));
}

async function testAcceptBidFlow() {
  const { ethers } = await network.connect();
  const [owner, seller, bidder, feeWallet] = await ethers.getSigners();

  const nftFactory = await ethers.getContractFactory("GenesoGenesis721");
  const nft = await nftFactory.deploy(owner.address, "Geneso", "GENESO");
  await nft.waitForDeployment();

  const marketFactory = await ethers.getContractFactory("GenesoMarketplace");
  const market = await marketFactory.deploy(owner.address, feeWallet.address, 250);
  await market.waitForDeployment();

  await nft.connect(owner).mintTo(seller.address, "ipfs://two");
  await nft.connect(seller).approve(await market.getAddress(), 1n);
  await market.connect(seller).createListing(await nft.getAddress(), 1n, ethers.parseEther("1"));

  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600);
  await market.connect(bidder).placeBid(1n, expiresAt, { value: ethers.parseEther("0.5") });
  await market.connect(seller).acceptBid(1n);

  const listing = await market.getListing(1n);
  const bid = await market.getHighestBid(1n);
  assert.equal(listing.active, false);
  assert.equal(bid.active, false);
  assert.equal(await nft.ownerOf(1n), bidder.address);
}

async function testCancelBidFlow() {
  const { ethers } = await network.connect();
  const [owner, seller, bidder, feeWallet] = await ethers.getSigners();

  const nftFactory = await ethers.getContractFactory("GenesoGenesis721");
  const nft = await nftFactory.deploy(owner.address, "Geneso", "GENESO");
  await nft.waitForDeployment();

  const marketFactory = await ethers.getContractFactory("GenesoMarketplace");
  const market = await marketFactory.deploy(owner.address, feeWallet.address, 250);
  await market.waitForDeployment();

  await nft.connect(owner).mintTo(seller.address, "ipfs://three");
  await nft.connect(seller).approve(await market.getAddress(), 1n);
  await market.connect(seller).createListing(await nft.getAddress(), 1n, ethers.parseEther("1"));

  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600);
  await market.connect(bidder).placeBid(1n, expiresAt, { value: ethers.parseEther("0.2") });
  await market.connect(bidder).cancelBid(1n);

  const bid = await market.getHighestBid(1n);
  assert.equal(bid.active, false);
  assert.equal(bid.amount, 0n);
}

async function testCancelListingFlow() {
  const { ethers } = await network.connect();
  const [owner, seller, bidder, feeWallet] = await ethers.getSigners();

  const nftFactory = await ethers.getContractFactory("GenesoGenesis721");
  const nft = await nftFactory.deploy(owner.address, "Geneso", "GENESO");
  await nft.waitForDeployment();

  const marketFactory = await ethers.getContractFactory("GenesoMarketplace");
  const market = await marketFactory.deploy(owner.address, feeWallet.address, 250);
  await market.waitForDeployment();

  await nft.connect(owner).mintTo(seller.address, "ipfs://four");
  await nft.connect(seller).approve(await market.getAddress(), 1n);
  await market.connect(seller).createListing(await nft.getAddress(), 1n, ethers.parseEther("1"));

  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600);
  await market.connect(bidder).placeBid(1n, expiresAt, { value: ethers.parseEther("0.25") });
  await market.connect(seller).cancelListing(1n);

  const listing = await market.getListing(1n);
  const bid = await market.getHighestBid(1n);
  assert.equal(listing.active, false);
  assert.equal(bid.active, false);
  assert.equal(await nft.ownerOf(1n), seller.address);
}

async function main() {
  await testBuyFlow();
  await testAcceptBidFlow();
  await testCancelBidFlow();
  await testCancelListingFlow();
  console.log("Smoke tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
