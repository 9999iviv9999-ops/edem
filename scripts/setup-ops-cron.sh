#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/logs/ops"
mkdir -p "$LOG_DIR"

TMP_FILE="$(mktemp)"
crontab -l 2>/dev/null > "$TMP_FILE" || true

upsert_cron_line() {
  local marker="$1"
  local line="$2"
  local sanitized
  sanitized="$(mktemp)"
  grep -vF "$marker" "$TMP_FILE" > "$sanitized" || true
  mv "$sanitized" "$TMP_FILE"
  echo "$line" >> "$TMP_FILE"
}

load_env='set -a; [ -f ./.env ] && . ./.env; set +a'

upsert_cron_line "# edem-smoke" "*/10 * * * * cd ${ROOT_DIR} && ${load_env} && bash scripts/smoke-with-alert.sh >> ${LOG_DIR}/smoke.log 2>&1 # edem-smoke"
upsert_cron_line "# edem-backup" "17 3 * * * cd ${ROOT_DIR} && ${load_env} && bash scripts/backup-db.sh >> ${LOG_DIR}/backup.log 2>&1 # edem-backup"
upsert_cron_line "# edem-auto-moderation" "*/15 * * * * cd ${ROOT_DIR} && ${load_env} && node scripts/auto-moderation-scan.mjs >> ${LOG_DIR}/auto-moderation.log 2>&1 # edem-auto-moderation"
upsert_cron_line "# edem-api-heal" "*/5 * * * * cd ${ROOT_DIR} && ${load_env} && bash scripts/api-self-heal.sh >> ${LOG_DIR}/api-heal.log 2>&1 # edem-api-heal"
upsert_cron_line "# edem-restore-test" "10 4 * * 0 cd ${ROOT_DIR} && ${load_env} && bash scripts/restore-backup-test.sh >> ${LOG_DIR}/restore-test.log 2>&1 # edem-restore-test"
upsert_cron_line "# edem-doctor" "25 6 * * * cd ${ROOT_DIR} && ${load_env} && bash scripts/ops-doctor-with-alert.sh >> ${LOG_DIR}/doctor.log 2>&1 # edem-doctor"

crontab "$TMP_FILE"
rm -f "$TMP_FILE"

echo "Cron automation installed:"
echo " - smoke every 10 minutes"
echo " - api self-heal every 5 minutes"
echo " - auto moderation every 15 minutes"
echo " - backup daily at 03:17"
echo " - restore test weekly on Sunday 04:10"
echo " - ops-doctor daily at 06:25 (Telegram on failure)"
echo ""
echo "Cron jobs auto-load ${ROOT_DIR}/.env, including TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID."
echo "Optional: API_CONTAINER=edem-api DB_CONTAINER=... DOCKER_EXEC_USER=postgres RESTORE_TEST_DB=... (backup/restore scripts)."
echo "Nginx: add ops/nginx-http-snippet-edem.conf into http {} then reload (see file header)."

