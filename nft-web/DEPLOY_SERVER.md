# Geneso NFT на своём сервере (Docker + nginx)

Статический бандл Vite внутри **nginx**. Переменные `VITE_*` вшиваются на этапе **build** — после смены адресов контрактов пересоберите образ.

## На VPS (Ubuntu, Docker)

1. Клонировать репозиторий и перейти в корень (где лежат `contracts/` и `nft-web/`).
2. Убедиться, что есть **`contracts/deployments/ethereum.json`** (как в репо после деплоя).
3. Выполнить:

```bash
chmod +x scripts/geneso-vps-docker-up.sh
GENESO_REPO=/path/to/edem-backend bash scripts/geneso-vps-docker-up.sh
```

Скрипт вызывает `npm run geneso:sync-nft-env`, затем в **`nft-web/`** — `docker compose up -d --build`.

Порт хоста: **`GENESO_NFT_PORT`** (по умолчанию `8080`). Если занят:  
`GENESO_NFT_PORT=18473 docker compose up -d --build`  
Откройте выбранный порт во **firewall** (`ufw allow 18473/tcp` и т.п.).

Для домена: в хостовом nginx `proxy_pass http://127.0.0.1:<порт>;` + TLS (Let’s Encrypt).

Вручную:

```bash
cd /path/to/edem-backend
npm run geneso:sync-nft-env
cd nft-web
cp .env.example .env   # при первом разе
npm run sync:env
docker compose up -d --build
```

## TLS и домен (ЭДЕМ на том же VPS)

В репозитории: **`ops/nginx-geneso.edem.press.conf`** — прокси на `127.0.0.1:18473` (или ваш `GENESO_NFT_PORT`), `server_name geneso.edem.press`.

1. DNS: **A** `geneso.edem.press` → IP сервера.
2. Скопировать конфиг в `/etc/nginx/sites-available/`, включить в `sites-enabled`, `nginx -t`, `reload`.
3. **`certbot --nginx -d geneso.edem.press`** (после применения DNS).

Пока нет сертификата, открывается HTTP на порту 80 для этого `server_name`.

## Обновление

```bash
cd /path/to/edem-backend && git pull
GENESO_REPO="$PWD" bash scripts/geneso-vps-docker-up.sh
```
