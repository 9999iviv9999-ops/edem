# Автодеплой ЭДЕМ из GitHub

После пуша в `main` можно автоматически:

1. **Vercel** — если фронт (`edem-web`) крутится на Vercel (например `app.edem.press`).
2. **VPS + Docker** — если прод на своём сервере (`docker compose`, как в `STABILITY_RUNBOOK.md`).

Оба варианта **опциональны**: без секретов workflow не падает, шаги просто пропускаются.

## 1) Vercel Deploy Hook (`edem-web`)

Файл: [`.github/workflows/edem-web-vercel-hook.yml`](../../.github/workflows/edem-web-vercel-hook.yml)

1. Vercel → проект с **Root Directory = `edem-web`** → **Settings → Git → Deploy Hooks**.
2. Создай hook для ветки **main** (Production).
3. GitHub → репозиторий → **Settings → Secrets and variables → Actions** → **New repository secret**:
   - Имя: **`VERCEL_DEPLOY_HOOK_EDEM`**
   - Значение: полный URL хука из Vercel.

При изменениях в `edem-web/**` на `main` workflow сделает `POST` на хук.

## 2) VPS по SSH (`docker compose`)

Файл: [`.github/workflows/edem-vps-deploy.yml`](../../.github/workflows/edem-vps-deploy.yml)

Секреты (Repository secrets):

| Secret | Описание |
|--------|-----------|
| **`DEPLOY_SSH_HOST`** | IP или hostname сервера (если пусто — деплой на VPS не запускается). |
| **`DEPLOY_SSH_USER`** | SSH-пользователь (например `deploy` или `root`). |
| **`DEPLOY_SSH_KEY`** | Приватный ключ **OpenSSH** (весь блок `-----BEGIN ... PRIVATE KEY-----` … `-----END …`). |
| **`DEPLOY_SSH_PATH`** | Абсолютный путь к клону репозитория на сервере, например `/var/www/edem-backend`. |
На сервере SSH по умолчанию **порт 22** (в workflow не задаётся; при необходимости другого порта добавь в `edem-vps-deploy.yml` параметр `port`).

На сервере:

- В `~/.ssh/authorized_keys` должен быть соответствующий **публичный** ключ.
- В каталоге `$DEPLOY_SSH_PATH` — `git remote` с доступом к GitHub (`git pull` без пароля: deploy key или HTTPS с credential).
- Установлены **Docker** и **docker compose v2**, команда `docker compose` в PATH.

Ручной деплой на том же хосте, что и vprok: из корня репозитория выполни **`bash ops/vps-up.sh`** (скрипт сам подключит `ops/docker-compose.vprok-db-network.yml`, если существует Docker-сеть **`edem-backend_default`**). Workflow **Deploy EDEM (VPS via SSH)** после `git pull` вызывает этот же скрипт.

Триггеры: push в `main` при изменениях в `edem-web/`, `src/`, `prisma/`, `Dockerfile`, `docker-compose.yml`, `ops/docker-compose.vprok-db-network.yml`, `ops/vps-up.sh`, `package.json`, `package-lock.json`, или кнопка **Run workflow** в GitHub Actions.

## Проверка

- **Vercel**: Deployments в проекте после пуша.
- **VPS**: лог job **Deploy EDEM (VPS via SSH)** в Actions; на сервере `docker compose ps`.
