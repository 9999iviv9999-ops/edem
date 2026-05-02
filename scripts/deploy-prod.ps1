param(
  [string]$SmokeApiUrl = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if (-not (Test-Path ".env")) {
  throw "ERROR: .env not found in $root"
}

$envFile = Get-Content ".env"
$dbLine = $envFile | Where-Object { $_ -match "^DATABASE_URL=" } | Select-Object -First 1
if (-not $dbLine -or $dbLine -notmatch "edem_app") {
  throw "ERROR: DATABASE_URL must use dedicated app user (edem_app), not postgres."
}

Write-Host "Pulling latest changes..."
git pull --ff-only

Write-Host "Rebuilding and restarting containers (migrations run in api entrypoint)..."
docker compose up -d --build

Write-Host "Importing DDX catalog (inside api container; DATABASE_URL must use host db)..."
docker compose exec -T api npm run import:gyms:ddx-only

Write-Host "Running smoke checks..."
$env:SMOKE_API_URL = $SmokeApiUrl
npm run api:smoke

Write-Host "Running ops doctor..."
$env:SMOKE_API_URL = $SmokeApiUrl
npm run ops:doctor

Write-Host "Ensuring cron automation is installed..."
if (Get-Command bash -ErrorAction SilentlyContinue) {
  npm run ops:cron:setup
} else {
  Write-Warning "bash not found: skip ops:cron:setup on this host."
}

Write-Host "Checking deep health..."
$health = Invoke-RestMethod -Uri ($SmokeApiUrl.TrimEnd("/") + "/health?deep=1") -TimeoutSec 10
if ($health.db -ne "ok") {
  throw "Deep health check failed: db is not ok"
}

Write-Host "Deploy completed successfully."
