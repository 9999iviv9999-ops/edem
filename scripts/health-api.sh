#!/usr/bin/env bash
# Проверка и перезапуск API на VPS (порт 3000), затем тест /api/gyms.
# Запуск из корня репозитория:  bash scripts/health-api.sh

set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== port 3000 ==="
ss -lntp 2>/dev/null | grep ':3000' || echo "(ничего не слушает 3000)"

echo "=== процессы node/ts-node-dev ==="
ps aux | grep -E 'node|ts-node-dev' | grep -v grep || true

echo "=== перезапуск API (убиваем старый dev на 3000) ==="
pkill -f 'ts-node-dev.*src/server.ts' 2>/dev/null || true
pkill -f 'node.*dist/server.js' 2>/dev/null || true
sleep 1

nohup npm run dev > /tmp/vprok-api.log 2>&1 &
disown
sleep 3

echo "=== лог (последние 15 строк) ==="
tail -n 15 /tmp/vprok-api.log || true

echo "=== curl /api/gyms (Москва, ЦАО, Арбат) ==="
curl -sS --max-time 15 "http://127.0.0.1:3000/api/gyms?city=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0&okrug=%D0%A6%D0%90%D0%9E&district=%D0%90%D1%80%D0%B1%D0%B0%D1%82" | head -c 500
echo ""

echo "=== готово ==="
