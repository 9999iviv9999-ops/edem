# Полный старт "с нуля" для edem:
# - ставит зависимости backend + edem-web
# - поднимает postgres в docker
# - применяет миграции и сид каталога залов
# - собирает edem-web
#
# Запуск:
#   powershell -ExecutionPolicy Bypass -File scripts/zero-from-scratch.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "===> 1/6 Install backend dependencies"
npm install

Write-Host "===> 2/6 Install edem-web dependencies"
npm --prefix edem-web install

if (!(Test-Path .env)) {
  Copy-Item .env.example .env
  Write-Host "Created .env from .env.example"
}

Write-Host "===> 3/6 Start PostgreSQL"
docker compose up -d db

Write-Host "===> 4/6 Wait for DB and apply migrations + seed"
node scripts/wait-and-seed.mjs

Write-Host "===> 5/6 Build backend"
npm run build

Write-Host "===> 6/6 Build edem-web"
npm run edem:web:build

Write-Host ""
Write-Host "Done."
Write-Host "Run backend: npm run dev"
Write-Host "Run web:     npm run edem:web:dev"
