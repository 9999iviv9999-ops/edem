#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SMOKE_URL="${SMOKE_API_URL:-http://127.0.0.1:3000}"

if /usr/bin/env SMOKE_API_URL="$SMOKE_URL" node scripts/ops-doctor.mjs; then
  echo "[ops-doctor-with-alert] OK"
  exit 0
fi

HOSTNAME="$(hostname)"
MSG="ЭДЕМ ALERT: ops-doctor failed on ${HOSTNAME}. URL=${SMOKE_URL}. Time=$(date -Is)"
bash scripts/notify-telegram.sh "$MSG" || true
exit 1
