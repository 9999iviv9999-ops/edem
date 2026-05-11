#!/usr/bin/env bash
# Поднять стек ЭДЕМ на VPS: если есть сеть edem-backend_default (Postgres vprok-db),
# подключаем overlay ops/docker-compose.vprok-db-network.yml. Иначе — только docker-compose.yml.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Общая БД vprok (vprok-db + база vprok) — нормальная схема на VPS: там же таблицы ЭДЕМ (User, Match, …).
# Без docker-сети edem-backend_default контейнер edem-api не резолвит vprok-db — не даём поднять сломанный стек.
if [[ -f .env ]]; then
  dburl="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  if [[ -n "${dburl:-}" ]] && echo "${dburl}" | grep -qE 'vprok-db:[0-9]+/vprok'; then
    if ! docker network inspect edem-backend_default >/dev/null 2>&1 || [[ ! -f ops/docker-compose.vprok-db-network.yml ]]; then
      echo "FATAL: DATABASE_URL на vprok-db/vprok, но нет сети edem-backend_default или файла ops/docker-compose.vprok-db-network.yml." >&2
      echo "       edem-api не сможет достучаться до Postgres. Подними vprok-db в той же сети или укажи @db:5432/edem для локального edem-db." >&2
      exit 1
    fi
  fi
fi

files=( -f docker-compose.yml )
if [[ -f ops/docker-compose.vprok-db-network.yml ]] && docker network inspect edem-backend_default >/dev/null 2>&1; then
  files+=( -f ops/docker-compose.vprok-db-network.yml )
  echo "ops/vps-up.sh: using vprok DB network overlay (edem-backend_default)."
else
  echo "ops/vps-up.sh: standard compose only (no edem-backend_default or overlay missing)."
fi

exec docker compose "${files[@]}" up -d --build "$@"
