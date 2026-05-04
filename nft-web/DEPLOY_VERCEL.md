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

## Если после push на GitHub «ничего не изменилось»

- Убедитесь, что этот Vercel-проект **подключён к репозиторию** и в **Settings → General → Root Directory** указано именно **`nft-web`** (не `web`, не корень монорепо).
- Откройте **Deployments** и проверьте, что последний деплой соответствует нужному коммиту (не Failed, не старая ветка).
- Сделайте **hard refresh** в браузере (Ctrl+Shift+R) или откройте сайт в приватном окне.
- Если прод у вас на **своём сервере (Docker)**, а не на Vercel — см. [`DEPLOY_SERVER.md`](./DEPLOY_SERVER.md): после `git push` на VPS обязательно **`git pull` + пересборка контейнера`.

### Проверка, что Vercel реально обновился (например [nft-web-roan.vercel.app](https://nft-web-roan.vercel.app/))

Откройте **исходный код страницы** (Ctrl+U) и посмотрите имя главного скрипта: `src="/assets/index-….js"`.

- Старый деплой (до логотипа и правок кошелька) часто имеет хеш вроде **`index-CW_DfBhW.js`** — значит **Production на Vercel давно не пересобирался** с GitHub.
- После нормального деплоя с `main` хеш **другой** (Vite меняет его при каждой сборке). Логотип отдаётся отдельным файлом **`/geneso-logo.jpg`** (в репозитории `nft-web/public/geneso-logo.jpg`).

Если хеш не меняется после push:

1. **Vercel → Deployments → … → Redeploy** (или новый деплой из последнего коммита `main`).
2. **Settings → General → Root Directory** = **`nft-web`**, **Build Command** = `npm run build`, **Output** = `dist`.
3. Убедитесь, что проект привязан к **этому** репозиторию и ветке **Production = main**.
4. (Опционально) Включите авто-деплой через **Deploy Hook**: Vercel создаёт URL, сохраните его в GitHub как секрет **`VERCEL_DEPLOY_HOOK_NFT`** — workflow [vercel-nft-web-hook.yml](../.github/workflows/vercel-nft-web-hook.yml) будет вызывать hook при каждом push в `nft-web/`.
