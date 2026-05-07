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
| `contracts/` | Solidity: `GenesoGenesis721`, `GenesoMarketplace`; прод-деплой на **Ethereum mainnet** (`deploy:ethereum`) |
| `mobile/` | Оболочка **Expo (React Native)** — один код на Android + iOS |
| Корень `package.json` | Скрипты `geneso:*` для установки, сборки, проверки env |

---

## Быстрый старт (из корня репозитория)

```bash
npm run geneso:bootstrap
npm run geneso:web:dev
```

Деплой контрактов (нужен `contracts/.env` с ключом и `FEE_RECIPIENT`):

```bash
npm run geneso:contracts:deploy:ethereum
npm run geneso:contracts:export:abi
npm run geneso:sync-nft-env
npm run geneso:doctor
```

Локально фронт:

```bash
npm run geneso:web:dev
```

Полный чеклист: **корневой `README.md`** (секция Geneso NFT).

---

## Переменные окружения

**contracts/.env**: `ETH_MAINNET_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `FEE_RECIPIENT`, `PLATFORM_FEE_BPS`, имя/символ NFT. Для прод-деплоя нужны **ETH на Ethereum mainnet** на кошельке деплоя.

**nft-web/.env**: `VITE_MARKETPLACE_ADDRESS`, `VITE_NFT_COLLECTION_ADDRESS`, опционально `VITE_WALLETCONNECT_PROJECT_ID`. Автозаполнение из `contracts/deployments/ethereum.json`: `npm run geneso:sync-nft-env`.

**Vercel** (проект `nft-web`): те же `VITE_*` в настройках проекта.

---

## Прод-деплой фронта

- **Vercel:** root directory `nft-web`, build `npm run build`, output `dist`. См. `nft-web/DEPLOY_VERCEL.md`.
- **Свой VPS (Docker + nginx):** `nft-web/DEPLOY_SERVER.md`, образ с nginx внутри контейнера; на хосте — **`ops/nginx-geneso.edem.press.conf`** (прокси на порт контейнера, по умолчанию после конфликтов портов часто **18473**).
- Пример Vercel-URL (если используется): **https://nft-web-roan.vercel.app** — при смене домена обновить документацию.

---

## UX и ошибки (веб)

- **`formatUserError`** в `nft-web/src/web3/errors.ts` — сообщения для отказа в кошельке, RPC, revert, сеть (EN/RU через `t()`).
- **`TxStatusBanner`** — ожидание receipt, revert.

---

## Мобильное приложение — как не плодить два проекта

- **Не нужны** два отдельных приложения «с нуля» на Kotlin и Swift для одного MVP.
- В **`mobile/`** уже **Expo**: **одна кодовая база** → две сборки (Android + iOS) и две публикации в магазинах.
- Отдельно только аккаунты разработчика (Google Play / Apple), подписи и иногда точечные platform-specific вещи.

Детали и env: `mobile/README.md`, `mobile/.env.example`.

---

## Контракты и сеть

- Фронт (`nft-web`) на **Ethereum mainnet** (chain id **1**). Файл деплоя: **`contracts/deployments/ethereum.json`**. После смены контрактов: `npm run export:abi` в `contracts/`.
- Скрипты `deploy:base` в репозитории — только для экспериментов; текущий фронт не переключён на Base.

---

## ЭДЕМ и Geneso на одном VPS

- Тот же сервер, что **ЭДЕМ** (`/opt/edem` и nginx `edem.press`), может обслуживать **Geneso** отдельным поддоменом (**geneso.edem.press**) — см. `ops/nginx-geneso.edem.press.conf`. Контейнер Geneso слушает на localhost (например **18473**).

---

## Если «программа вылетит»

1. Этот файл: **`docs/GENESO_PROJECT_MEMORY.md`**
2. Корневой **`README.md`** (Geneso)
3. **`nft-web/README.md`**, **`nft-web/DEPLOY_SERVER.md`**, **`contracts/README.md`**, **`mobile/README.md`**

---

*Последнее обновление: Ethereum mainnet; Geneso NFT web, Docker, nginx snippet geneso.edem.press, geneso:bootstrap / geneso:doctor / geneso:sync-nft-env, i18n EN/RU.*
