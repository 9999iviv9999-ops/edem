#!/usr/bin/env bash
# Поднять стек ЭДЕМ на VPS: если есть сеть edem-backend_default (Postgres vprok-db),
# подключаем overlay ops/docker-compose.vprok-db-network.yml. Иначе — только docker-compose.yml.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

files=( -f docker-compose.yml )
if [[ -f ops/docker-compose.vprok-db-network.yml ]] && docker network inspect edem-backend_default >/dev/null 2>&1; then
  files+=( -f ops/docker-compose.vprok-db-network.yml )
  echo "ops/vps-up.sh: using vprok DB network overlay (edem-backend_default)."
else
  echo "ops/vps-up.sh: standard compose only (no edem-backend_default or overlay missing)."
fi

exec docker compose "${files[@]}" up -d --build "$@"
