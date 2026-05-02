#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "ERROR: .env not found in $ROOT_DIR"
  exit 1
fi

if ! grep -Eq '^DATABASE_URL=.*edem_app' ".env"; then
  echo "ERROR: DATABASE_URL must use dedicated app user (edem_app), not postgres."
  echo "Expected example: DATABASE_URL=postgresql://edem_app:PASSWORD@db:5432/edem?schema=public"
  exit 1
fi

echo "Pulling latest changes..."
git pull --ff-only

echo "Rebuilding and restarting containers (migrations run in api entrypoint)..."
docker compose up -d --build

echo "Verifying prisma migration status in api container..."
docker compose exec -T api npx prisma migrate status

echo "Importing DDX catalog (inside api container; DATABASE_URL must use host db)..."
docker compose exec -T api npm run import:gyms:ddx-only

echo "Running smoke checks..."
npm run api:smoke

echo "Running ops doctor..."
npm run ops:doctor

echo "Ensuring cron automation is installed..."
npm run ops:cron:setup

echo "Checking deep health..."
curl -fsS --max-time 10 "http://127.0.0.1:3000/health?deep=1" >/dev/null

echo "Deploy completed successfully."
