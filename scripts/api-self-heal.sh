#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_CONTAINER="${API_CONTAINER:-edem-api}"
DB_CONTAINER="${DB_CONTAINER:-edem-db}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health?deep=1}"

if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null; then
  echo "[api-self-heal] API healthy (incl. DB)"
  exit 0
fi

echo "[api-self-heal] API unhealthy, checking logs..."
if docker logs --tail 120 "$API_CONTAINER" 2>&1 | grep -q "P1000"; then
  echo "[api-self-heal] detected P1000, resetting db password and restarting API"
  docker exec -u postgres "$DB_CONTAINER" psql -d postgres -c "ALTER ROLE postgres WITH PASSWORD 'postgres';"
  docker restart "$API_CONTAINER" || docker compose restart api
  sleep 6
fi

if curl -fsS --max-time 8 "$HEALTH_URL" >/dev/null; then
  MSG="ЭДЕМ RECOVERY: API self-heal recovered service on $(hostname) at $(date -Is)"
  bash scripts/notify-telegram.sh "$MSG" || true
  echo "[api-self-heal] recovered"
  exit 0
fi

MSG="ЭДЕМ ALERT: API is still down after self-heal on $(hostname). Check docker logs ${API_CONTAINER}. Time=$(date -Is)"
bash scripts/notify-telegram.sh "$MSG" || true
echo "[api-self-heal] failed"
exit 1

