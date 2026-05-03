# Vercel — Geneso NFT only

Production chain: **Ethereum mainnet** (chain id **1**). Set env vars to addresses from `contracts/deployments/ethereum.json` after `npm run deploy:ethereum` in `contracts/`.

1. Create a **new** Vercel project (not the ЭДЕМ dating `web` project).
2. **Root directory:** `nft-web`
3. Framework: **Vite**, build `npm run build`, output `dist`
4. Environment variables:
   - `VITE_MARKETPLACE_ADDRESS`
   - `VITE_NFT_COLLECTION_ADDRESS`
   - `VITE_WALLETCONNECT_PROJECT_ID` (optional — from [WalletConnect Cloud](https://cloud.walletconnect.com))

You get a clean **Geneso** marketplace URL: `/`, `/item/:id`, `/bids`, `/profile`.
