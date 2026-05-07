#!/usr/bin/env bash
# Полный старт "с нуля" для edem:
# - ставит зависимости backend + edem-web
# - поднимает postgres в docker
# - применяет миграции и сид каталога залов
# - собирает edem-web
#
# Запуск:
#   bash scripts/zero-from-scratch.sh

set -euo pipefail
cd "$(dirname "$0")/.."

echo "===> 1/6 Install backend dependencies"
npm install

echo "===> 2/6 Install edem-web dependencies"
npm --prefix edem-web install

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

echo "===> 3/6 Start PostgreSQL"
docker compose up -d db

echo "===> 4/6 Wait for DB and apply migrations"
node scripts/wait-and-seed.mjs

echo "===> 5/6 Build backend"
npm run build

echo "===> 6/6 Build edem-web"
npm run edem:web:build

echo ""
echo "Done."
echo "Run backend: npm run dev"
echo "Run web:     npm run edem:web:dev"
