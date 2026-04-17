#!/usr/bin/env bash
# Из корня репозитория: bash scripts/init-local-db.sh
# Перезаливка seed-*: FORCE_GYM_SEED=1 bash scripts/init-local-db.sh

set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

docker compose up -d db
export FORCE_GYM_SEED="${FORCE_GYM_SEED:-}"
node scripts/wait-and-seed.mjs

echo "Done. API: npm run dev"
