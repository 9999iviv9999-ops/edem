# Локальная инициализация: Postgres в Docker → миграции → сид залов (Москва и остальные города).
# Из корня репозитория:
#   powershell -ExecutionPolicy Bypass -File scripts/init-local-db.ps1
# Полная перезаливка каталога seed-*:
#   powershell -ExecutionPolicy Bypass -File scripts/init-local-db.ps1 -ForceGymSeed

param([switch]$ForceGymSeed)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  Write-Host "Created .env from .env.example"
}

docker compose up -d db
if ($ForceGymSeed) {
  $env:FORCE_GYM_SEED = "1"
}
node scripts/wait-and-seed.mjs
if ($ForceGymSeed) { Remove-Item Env:FORCE_GYM_SEED -ErrorAction SilentlyContinue }

Write-Host "Done. API: npm run dev   Web: cd web && npm run dev"
