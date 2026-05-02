#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DB_CONTAINER="${DB_CONTAINER:-edem-db}"
PG_USER="${PG_USER:-postgres}"
DOCKER_EXEC_USER="${DOCKER_EXEC_USER:-postgres}"
RESTORE_TEST_DB="${RESTORE_TEST_DB:-vprok_restore_test}"

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
LATEST_BACKUP="$(ls -1t "$BACKUP_DIR"/vprok-*.sql.gz 2>/dev/null | head -n 1 || true)"
RESTORE_DB="$RESTORE_TEST_DB"

if [[ -z "$LATEST_BACKUP" ]]; then
  MSG="ЭДЕМ ALERT: restore-test failed, no backup files found in ${BACKUP_DIR}"
  bash scripts/notify-telegram.sh "$MSG" || true
  echo "[restore-test] no backup file found"
  exit 1
fi

echo "[restore-test] using backup: $LATEST_BACKUP (container=${DB_CONTAINER})"

docker exec -u "$DOCKER_EXEC_USER" "$DB_CONTAINER" psql -U "$PG_USER" -d postgres -c "DROP DATABASE IF EXISTS \"${RESTORE_DB}\";"
docker exec -u "$DOCKER_EXEC_USER" "$DB_CONTAINER" psql -U "$PG_USER" -d postgres -c "CREATE DATABASE \"${RESTORE_DB}\";"

if ! gzip -dc "$LATEST_BACKUP" | docker exec -i -u "$DOCKER_EXEC_USER" "$DB_CONTAINER" psql -U "$PG_USER" -d "$RESTORE_DB" >/dev/null; then
  docker exec -u "$DOCKER_EXEC_USER" "$DB_CONTAINER" psql -U "$PG_USER" -d postgres -c "DROP DATABASE IF EXISTS \"${RESTORE_DB}\";" >/dev/null || true
  MSG="ЭДЕМ ALERT: restore-test failed while importing backup ${LATEST_BACKUP}"
  bash scripts/notify-telegram.sh "$MSG" || true
  echo "[restore-test] restore failed"
  exit 1
fi

COUNTS="$(docker exec -u "$DOCKER_EXEC_USER" "$DB_CONTAINER" psql -U "$PG_USER" -d "$RESTORE_DB" -t -A -c "SELECT (SELECT count(*) FROM \"User\") || ',' || (SELECT count(*) FROM \"Gym\");")"
docker exec -u "$DOCKER_EXEC_USER" "$DB_CONTAINER" psql -U "$PG_USER" -d postgres -c "DROP DATABASE IF EXISTS \"${RESTORE_DB}\";" >/dev/null

MSG="ЭДЕМ RESTORE TEST OK: backup=$(basename "$LATEST_BACKUP"), counts(user,gym)=${COUNTS}, host=$(hostname), time=$(date -Is)"
bash scripts/notify-telegram.sh "$MSG" || true
echo "[restore-test] success counts=${COUNTS}"

