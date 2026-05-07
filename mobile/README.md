# ЭДЕМ Mobile (Expo)

## Start

```bash
cd mobile
npm install
npm start
```

## Where app files are stored

- Source code: `mobile/`
- Generated local bundles:
  - `mobile/build-export-android/`
  - `mobile/build-export-ios/`
- Cloud store builds (`.aab` / `.ipa`) appear in your Expo dashboard after EAS build:
  - [https://expo.dev/accounts](https://expo.dev/accounts)

## Env

Copy `.env.example` to `.env`.

- `EXPO_PUBLIC_API_URL` (default: `https://edem.press`)

## Current status

- Tabs: Лента / Чаты / Профиль
- Вход по номеру телефона и паролю
- Чтение данных из API ЭДЕМ (`/api/profiles/me`, `/api/matches`, `/api/profiles/gyms/:gymId`)
- Базовая подготовка к публикации в Play Store / App Store
