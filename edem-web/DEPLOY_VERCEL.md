# Vercel — ЭДЕМ web (`edem-web/`)

Отдельный фронт **ЭДЕМ** (лента, профиль, залы). Не путать с **`web/`** — там только **Vprok**.

## Build settings (новый проект в Vercel)

- Framework: **Vite**
- Root directory: **`edem-web`**
- Build command: `npm run build`
- Output directory: `dist`
- Install: `npm install` (working directory `edem-web`)

## Домен `app.edem.press` (сейчас висит на проекте **`edem`**)

По `vercel domains inspect`: поддомен привязан к проекту **`edem`**, у которого в настройках, скорее всего, **Root Directory = `web`**. После того как в репозитории `web/` стал **Vprok**, на `app.edem.press` уехали сборки Vprok.

Сделай **одно** из двух (достаточно первого):

### Вариант 1 — поправить существующий проект `edem` (проще для домена)

1. [Vercel](https://vercel.com) → проект **`edem`** → **Settings → General**.
2. **Root Directory**: было `web` → поставь **`edem-web`** (папка из этого репозитория).
3. Сохрани и сделай **Redeploy** последнего деплоя (или пуш в `main`).

Домен `app.edem.press` остаётся на том же проекте, меняется только папка сборки.

### Вариант 2 — отдельный проект `edem-web`

1. В проекте **`edem`**: **Settings → Domains** — удали `app.edem.press`.
2. В проекте **`edem-web`** (уже можно создать из CLI): **Domains** — добавь `app.edem.press`.
3. Root Directory проекта: **`edem-web`**.

Проект **`edem-web`** в этой команде уже создан (`edem-web.vercel.app`); для прод-домена либо вариант 1, либо перенеси домен на него.

## API

`vercel.json` проксирует `/api/*` → `https://edem.press/api/*` (бэкенд на том же домене, где крутится API). Раньше использовался несуществующий в DNS `api.edem.press` — из‑за этого лента и профиль «ломались» на Vercel.

Опционально в **Environment Variables**: `VITE_API_URL=https://edem.press` — прямой вызов API (нужен CORS на бэкенде для `*.vercel.app`).

## Маршрут `/vprok-preview`

На домене ЭДЕМ этот путь **редиректит** на `https://vprok.club/vprok-preview`, чтобы старые закладки не открывали Vprok внутри ЭДЕМ.

## Локально

```bash
cd edem-web
npm install
npm run dev
```

API: подними `edem-backend` на `:3000` или укажи `VITE_API_URL` в `.env`.
