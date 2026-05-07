# Geneso NFT Contracts (MVP)

- `src/GenesoGenesis721.sol` — ERC-721 collection.
- `src/GenesoMarketplace.sol` — listings, buy, bids, platform fee.

**Production target: Ethereum mainnet** — must match `nft-web/src/web3/config.ts` (`mainnet`, chain id 1).

Из **корня репозитория** (без ручного копирования адресов во фронт): `npm run geneso:bootstrap` — подтянет `nft-web/.env` из `deployments/ethereum.json`.

## Setup

1. Copy `.env.example` → `.env` (deployer wallet with **ETH on Ethereum mainnet** for gas).
2. `npm install`
3. `npm run compile`
4. `npm run test` (smoke)

## Deploy (Ethereum)

```bash
npm run deploy:ethereum
npm run export:abi
```

One-shot: `npm run deploy:ethereum:full` (deploy + export ABI + writes `nft-web/.env.geneso`).

Then merge `nft-web/.env.geneso` into `nft-web/.env` (or copy the two `VITE_*` lines) and set the same vars on Vercel.

To regenerate env only from an existing `deployments/ethereum.json`: `npm run sync:nft-web-env`.

## Frontend env

- `VITE_MARKETPLACE_ADDRESS=0x...`
- `VITE_NFT_COLLECTION_ADDRESS=0x...`

## Notes

- Payments in native ETH (`address(0)`).
- Platform fee: owner updates with cap `MAX_FEE_BPS = 1000` (10%).
- Event indexer: `npm run index:events` → `deployments/ethereum-events.json` (uses `deployments/ethereum.json`).

## Optional: Base

The repo still includes `deploy:base` and a `base` Hardhat network for experiments only. The shipped **nft-web** app is wired to **Ethereum mainnet** only; do not mix Base addresses with the current frontend config.
