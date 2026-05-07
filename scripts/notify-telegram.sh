#!/usr/bin/env bash
set -euo pipefail

MESSAGE="${1:-}"
if [[ -z "$MESSAGE" ]]; then
  echo "Usage: scripts/notify-telegram.sh 'message'"
  exit 1
fi

TOKEN="${TELEGRAM_BOT_TOKEN:-}"
CHAT_ID="${TELEGRAM_CHAT_ID:-}"

if [[ -z "$TOKEN" || -z "$CHAT_ID" ]]; then
  echo "[notify-telegram] skipped: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set"
  exit 0
fi

curl -sS --max-time 20 \
  -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\":\"${CHAT_ID}\",\"text\":\"${MESSAGE}\"}" >/dev/null

echo "[notify-telegram] sent"

