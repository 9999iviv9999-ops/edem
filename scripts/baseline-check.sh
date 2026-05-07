#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOG_DIR="${ROOT_DIR}/logs/ops"
mkdir -p "$LOG_DIR"

TS="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="${LOG_DIR}/baseline-${TS}.log"
SMOKE_URL="${SMOKE_API_URL:-http://127.0.0.1:3000}"

{
  echo "[baseline] started at $(date -Is)"
  echo "[baseline] root=${ROOT_DIR}"
  echo "[baseline] smoke_url=${SMOKE_URL}"

  echo "[baseline] step=backup"
  bash scripts/backup-db.sh

  echo "[baseline] step=smoke"
  SMOKE_API_URL="${SMOKE_URL}" node scripts/smoke-api.mjs

  echo "[baseline] step=ok finished at $(date -Is)"
} | tee -a "$LOG_FILE"

echo "[baseline] report=${LOG_FILE}"

