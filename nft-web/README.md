# Geneso NFT — curated esoteric marketplace (web)

Отдельное приложение от ЭДЕМ. **Быстрый старт из корня монорепозитория:**

```bash
cd ..
npm run geneso:bootstrap
npm run geneso:web:dev
```

Откроется `http://localhost:5174` (порт в `vite.config.ts`). `bootstrap` сам подставит `VITE_*` из `contracts/deployments/ethereum.json` в **`.env`**.

Только эта папка:

```bash
cd nft-web
npm install
cp .env.example .env
npm run sync:env
npm run dev
```

(`sync:env` вызывает корневой скрипт и заполняет `VITE_*` из `../contracts/deployments/ethereum.json`.)

Сеть: **Ethereum mainnet** (`src/web3/config.ts`).

## Checklist before real usage

1. **Contracts** — Deploy `GenesoMarketplace` + `GenesoGenesis721` (or your ERC-721) from `contracts/`, note addresses.
2. **Env** — `VITE_MARKETPLACE_ADDRESS` required. `VITE_NFT_COLLECTION_ADDRESS` required to list NFTs from the form. Redeploy / restart after changes.
3. **ABIs** — After contract changes, run `npm run export:abi` in `contracts/` so JSON lands in `nft-web/src/web3/abis/generated/`.
4. **Wallet** — Browser wallet on **Ethereum mainnet**, with **ETH** for gas.
5. **Listing flow** — Own a token → **Approve** marketplace for that token ID → **createListing** (Discover page form).
6. **Production** — Set the same `VITE_*` vars in Vercel (or your host) and redeploy. See `DEPLOY_VERCEL.md`.
7. **Optional** — `VITE_WALLETCONNECT_PROJECT_ID` for WalletConnect / mobile QR.

## Routes

- `/` — Discover (grid + list form)
- `/item/:listingId` — Item detail
- `/bids` — Offers
- `/profile` — Wallet, stats, activity

## i18n

EN / RU, language toggle in header; preference stored in `localStorage` (`geneso-locale`).

## Deploy (Vercel)

See `DEPLOY_VERCEL.md`.
