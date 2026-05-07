# STABILITY RUNBOOK (PROD)

Краткий чеклист стабильного продакшена API + веб.

В репозитории включён **GitHub Actions** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): на push/PR в `main`/`master` — `preflight`, сборка API и `edem-web` (без Docker).

После `npm ci` / `npm install` автоматически вызывается **`prisma generate`**, если в дереве уже есть `prisma/schema.prisma` (скрипт `scripts/postinstall-prisma.mjs`; в Docker до `COPY .` шаг пропускается). Перед `npm run build` то же через **`prebuild`**, чтобы клиент не устаревал относительно схемы. Ниже — блок **готовых команд для VPS** (скопировать в каталог репозитория на сервере).

## VPS: один проход после `git pull`

```bash
cd /path/to/edem-backend   # замени на реальный путь

# зависимости (нужны для preflight → npx prisma validate)
npm ci

# проверка .env, prisma schema, docker compose
npm run preflight -- --compose

# сборки
npm run build
npm --prefix edem-web ci
npm --prefix edem-web run build

# контейнеры
docker compose up -d --build

# проверки (локально на сервере, API на 127.0.0.1:3000)
set -a && [ -f ./.env ] && . ./.env && set +a
npm run ops:doctor
npm run api:smoke

# cron (подхватывает .env для Telegram и имён контейнеров)
npm run ops:cron:setup
```

Проверка с **внешнего URL** (опционально, с любой машины):

```bash
export SMOKE_API_URL="https://edem.press"
npm run ops:doctor
# полный смоук с регистрацией лучше не гонять против прод без отдельного стенда — используй ops:doctor + ручной смоук
```

## 1) Environment (`.env` на сервере)

Рекомендуемые значения:

- `ACCESS_TOKEN_TTL_MINUTES=0` — access JWT без `exp` (см. политику безопасности проекта).
- `REFRESH_TOKEN_TTL_DAYS=36500`
- `TELEGRAM_BOT_TOKEN=...` и `TELEGRAM_CHAT_ID=...` — для `smoke-with-alert`, `ops-doctor-with-alert`, `api-self-heal`, `restore-backup-test`.

Если имена контейнеров не совпадают с дефолтами:

- `API_CONTAINER=edem-api`
- `DB_CONTAINER=vprok-db`
- `PG_USER=postgres`
- `PG_DB=vprok`
- `DOCKER_EXEC_USER=postgres`
- `RESTORE_TEST_DB=vprok_restore_test`

## 2) Nginx: лимит на `/api/auth/`

1. В основной конфиг nginx, внутри `http { }`, подключи:

   `ops/nginx-http-snippet-edem.conf`

2. В активном server-конфиге (аналог `edem.press.nginx`) в `location /api/auth/` **раскомментируй**:

   `limit_req zone=edem_api_auth burst=45 nodelay;`

3. Проверка и перезагрузка:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 3) Cron (автоматизация)

```bash
npm run ops:cron:setup
```

Задачи:

- смоук каждые 10 минут + Telegram при падении;
- self-heal API каждые 5 минут;
- авто-модерация каждые 15 минут;
- бэкап БД ежедневно в 03:17;
- тест восстановления из бэкапа — по воскресеньям 04:10;
- **ops-doctor ежедневно в 06:25** + Telegram при падении.

Все строки cron **подгружают `./.env`** перед запуском.

Ручной запуск проверки с алертом:

```bash
npm run ops:doctor:alert
npm run ops:smoke:alert
```

## 4) Что ещё нужно с вашей стороны (не в коде)

- Реально применить nginx-сниппет и `reload` на проде.
- Убедиться, что в `.env` заданы Telegram и корректные имена контейнеров БД.
- Периодически смотреть `logs/ops/*.log`.
- Внешний мониторинг (UptimeRobot / Better Stack и т.д.) на `https://edem.press/health?deep=1` — опционально, но сильно повышает уверенность.

## 5) Ожидаемые результаты проверок

- `GET /health` → `status: ok`
- `GET /health?deep=1` → `db: ok`
- `GET /api/gyms/cities` — непустой массив
- `npm run api:smoke` — успешная регистрация смоук-пользователя (лучше на стенде; на проде — реже или отдельный флаг)

## 6) Рекомендации по продукту

См. `docs/PRODUCT_RECOMMENDATIONS.md` — сравнение с типичными приложениями и приоритеты развития.
