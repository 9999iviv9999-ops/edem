# Geneso — памятка проекта (сохранено для контекста)

Этот файл — **консолидированная выжимка** решений по Geneso NFT: продукт, репозиторий, команды, деплой, мобильная стратегия. Его можно коммитить в git; при сбое IDE/чата контекст восстанавливается из репозитория.

---

## Продукт и позиционирование

- **Geneso** — кураторский NFT-маркетплейс для **эзотерической** digital-культуры: таро, астрология, руны, сакральная геометрия, оккультное/духовное искусство.
- **Тон:** спокойный, премиальный, без токсичного «to the moon»; коллекционирование с смыслом (`Collect now`, `Place offer`, `Withdraw listing` и т.д.).
- **Отличие от OpenSea:** вертикальный фокус, доверие к авторам, community-слой (в перспективе: верификация, подборки, категории).

---

## Структура репозитория

| Путь | Назначение |
|------|------------|
| `nft-web/` | Standalone веб-маркетплейс Geneso (Vite + React + wagmi/viem), **отдельно** от dating-приложения `web/` |
| `contracts/` | Solidity: `GenesoGenesis721`, `GenesoMarketplace`; деплой на **Base mainnet** |
| `mobile/` | Оболочка **Expo (React Native)** — один код на Android + iOS |
| Корень `package.json` | Скрипты `geneso:*` для установки, сборки, проверки env |

---

## Быстрый старт (из корня репозитория)

```bash
npm run geneso:bootstrap
```

Дальше: скопировать `contracts/.env.example` → `contracts/.env`, `nft-web/.env.example` → `nft-web/.env`, задеплоить контракты на **Base mainnet**, прописать адреса, экспорт ABI:

```bash
npm run geneso:contracts:deploy:base
npm run geneso:contracts:export:abi
npm run geneso:doctor
# CI / строгая проверка:
npm run geneso:doctor -- --strict
```

Локально фронт:

```bash
npm run geneso:web:dev
```

Полный чеклист также в **корневом `README.md`** (секция «Geneso NFT quickstart»).

---

## Переменные окружения

**contracts/.env** (пример в `contracts/.env.example`): `BASE_MAINNET_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `FEE_RECIPIENT`, `PLATFORM_FEE_BPS`, имя/символ NFT. Для прод-деплоя нужны **реальные ETH на Base** на кошельке деплоя.

**nft-web/.env**: `VITE_MARKETPLACE_ADDRESS`, `VITE_NFT_COLLECTION_ADDRESS`, опционально `VITE_WALLETCONNECT_PROJECT_ID`.

**Vercel** (проект `nft-web`): те же `VITE_*` в настройках проекта.

---

## Прод-деплой фронта

- Проект Vercel с **root directory `nft-web`**, build `npm run build`, output `dist`.
- Алиас продакшена (по состоянию на сессию разработки): **https://nft-web-roan.vercel.app** — при смене домена обновить этот файл или `nft-web/DEPLOY_VERCEL.md`.

---

## UX и ошибки (веб)

- Общая функция **`formatUserError`** в `nft-web/src/web3/errors.ts` — человекочитаемые сообщения для отказа в кошельке, RPC, revert, сеть.
- Используется на страницах маркетплейса и в **`TxStatusBanner`** (ожидание receipt, revert).

---

## Мобильное приложение — как не плодить два проекта

- **Не нужны** два отдельных приложения «с нуля» на Kotlin и Swift для одного MVP.
- В **`mobile/`** уже **Expo**: **одна кодовая база** → две сборки (Android + iOS) и две публикации в магазинах.
- Отдельно только аккаунты разработчика (Google Play / Apple), подписи и иногда точечные platform-specific вещи.

Детали и env: `mobile/README.md`, `mobile/.env.example`.

---

## Контракты и сеть

- Фронт (`nft-web`) и конфиг mobile ориентированы на **Base mainnet** (chain id **8453**). Тестовые сети в основном флоу **не используются**.
- Файл деплоя: `contracts/deployments/base.json`. После деплоя адреса должны совпадать с ABI в `nft-web/src/web3/abis/generated/`.

---

## Если «программа вылетит»

1. Открыть этот файл: **`docs/GENESO_PROJECT_MEMORY.md`**
2. Корневой **`README.md`** (Geneso quickstart)
3. **`nft-web/README.md`**, **`contracts/README.md`**, **`mobile/README.md`**

Вся существенная логика и команды дублируются там, где разработчику их искать естественно.

---

*Последнее обновление: Base mainnet only; Geneso NFT web, contracts, Expo mobile, geneso:bootstrap / geneso:doctor, formatUserError, Vercel.*
