# Staging: что отличается от прода

**Публичная ссылка без отдельного поддомена (работает сразу):** [https://edem.press/stg/](https://edem.press/stg/) — отдельная БД и API на портах staging, префикс в nginx (`ops/nginx-snippet-edem-press-stg-path.conf`).

Опционально позже: поддомен [https://staging.edem.press](https://staging.edem.press) (нужна **A**-запись и расширение сертификата Let’s Encrypt).

Один источник правды по «копии стенда». Прод — `docker compose` только с `docker-compose.yml`; staging — **те же два файла плюс** `docker-compose.staging.yml` и `.env.staging`.

## Сводка

| Что | Прод | Staging |
|-----|------|---------|
| Имя проекта Compose | по умолчанию / каталог | **`edem-staging`** (в `docker-compose.staging.yml`) |
| Сеть Docker | `edem_default` | **`edem_staging_net`** |
| Postgres (контейнер) | `edem-db` | **`edem-db-staging`** |
| API (контейнер) | `edem-api` | **`edem-api-staging`** |
| Веб (контейнер) | `edem-web` | **`edem-web-staging`** |
| Том БД | `…_edem_pgdata` (от проекта) | **отдельный** том у проекта `edem-staging` |
| Порт API (хост) | `127.0.0.1:3000` | **`127.0.0.1:3001`** |
| Порт веб (хост) | `127.0.0.1:8080` | **`127.0.0.1:8081`** |
| Переменные API | `.env` | **`.env.staging`** |
| Загрузки на диске | `./uploads` | **`./uploads-staging`** |
| Сборка веба | без метки среды | **`VITE_APP_ENV=staging`** → оранжевая плашка в UI |

## Файлы в репозитории (что трогаем руками)

- **`docker-compose.yml`** — прод; staging его **не правит**, только подмешивается вторым файлом.
- **`docker-compose.staging.yml`** — переопределения: имя проекта, контейнеры, порты, сеть, `env_file`, том загрузок, `build.args` для веба.
- **`.env.staging.example`** — шаблон; рабочий **`./.env.staging`** в git не коммитится (см. `.gitignore`).
- **`uploads-staging/`** — создаётся при первом запуске; в git не попадает.
- **`ops/nginx-staging-edem-press-snippet.conf`** — пример `server` для поддомена (например `staging.edem.press` → `8081`).
- **`edem-web/src/components/EnvRibbon.tsx`** — плашка, если `VITE_APP_ENV=staging`.
- **`edem-web/Dockerfile`** — принимает `ARG VITE_APP_ENV`.

## VPS с продом «vprok-*» (postgres, контейнеры vprok-api / vprok-web)

Если на сервере **не** тот `docker-compose.yml`, что в корне репозитория (отдельная БД `edem` / `edem_app`), а стек как **vprok-db** + отдельный `DATABASE_URL`, используйте отдельный файл:

- **[`ops/docker-compose.staging.vps.yml`](../ops/docker-compose.staging.vps.yml)** — своя БД `vprok_staging`, порты **3001** / **8081**, переменная **`STAGING_POSTGRES_PASSWORD`** в `.env.staging`.

```bash
# пример
cp .env .env.staging
# добавить в .env.staging: STAGING_POSTGRES_PASSWORD=<случайная строка>
# выставить WEB_BASE_URL и CORS для staging-домена
docker compose -f docker-compose.staging.vps.yml --env-file .env.staging up -d --build
```

Nginx: сначала HTTP — [`ops/nginx-staging.edem.press.http.conf`](../ops/nginx-staging.edem.press.http.conf); после выпуска сертификата с SAN на `staging.edem.press` — [`ops/nginx-staging.edem.press.https.conf`](../ops/nginx-staging.edem.press.https.conf) (часто проще **расширить** существующий сертификат `edem.press` через certbot `--expand`, тогда пути TLS те же, что у основного сайта: `live/edem.press`).

## Включить https://staging.edem.press на сервере

1. **DNS** у регистратора: запись **A** для `staging.edem.press` на IP сервера (при использовании IPv6 — корректная **AAAA**). Пока записи нет, Let's Encrypt выдаст ошибку **NXDOMAIN**; nginx с `server_name staging.edem.press` всё равно можно проверить так: `curl -H 'Host: staging.edem.press' http://127.0.0.1/`.
2. **Конфиг nginx:** блоки для `staging.edem.press` уже в **[`edem.press.nginx`](../edem.press.nginx)** (в конце файла); скопируйте/синхронизируйте с активным конфигом на хосте и выполните `nginx -t`.
3. **TLS:** например  
   `certbot certonly --nginx -d staging.edem.press`  
   Сертификат по умолчанию: `/etc/letsencrypt/live/staging.edem.press/`. Если добавляете имя в существующий сертификат `edem.press`, замените в конфиге пути `ssl_certificate` на `live/edem.press`.
4. **Перезагрузка:** `systemctl reload nginx`.
5. **Docker staging** слушает `127.0.0.1:3001` и `127.0.0.1:8081` — команда ниже; в **`.env.staging`** задайте `WEB_BASE_URL` и `CORS_ALLOW_ORIGINS` на `https://staging.edem.press` (как в `.env.staging.example`).

## Команды

Поднять (из корня репозитория):

```bash
# сначала: валидный .env.staging (не копируй пароли из примера дословно)
npm run preflight:staging

docker compose -f docker-compose.yml -f docker-compose.staging.yml --env-file .env.staging up -d --build
```

Остановить:

```bash
docker compose -f docker-compose.yml -f docker-compose.staging.yml --env-file .env.staging down
```

Сбросить **только** данные БД staging: `down` с флагом `-v` (осторожно).

## Что вы **не** меняете на проде, пока тестируете staging

Любые правки кода можно гонять на staging тем же репозиторием: пересборка образов `api` / `web` в проекте `edem-staging`. В прод заезжаете отдельным деплоем (тот же compose **без** `docker-compose.staging.yml`).
