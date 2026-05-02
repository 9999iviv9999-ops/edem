#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$BACKUP_DIR/vprok-$TIMESTAMP.sql.gz"
KEEP_DAYS="${KEEP_DAYS:-14}"
DB_CONTAINER="${DB_CONTAINER:-edem-db}"
PG_USER="${PG_USER:-postgres}"
PG_DB="${PG_DB:-vprok}"

mkdir -p "$BACKUP_DIR"

echo "Creating DB backup: $OUT_FILE (container=${DB_CONTAINER})"
docker exec "$DB_CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" | gzip > "$OUT_FILE"
echo "Backup complete: $OUT_FILE"

echo "Removing backups older than $KEEP_DAYS days"
find "$BACKUP_DIR" -name "vprok-*.sql.gz" -type f -mtime +"$KEEP_DAYS" -delete

echo "Done"
