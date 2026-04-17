#!/bin/sh
set -e
echo "Applying Prisma migrations..."

if ! npx prisma migrate deploy; then
  echo "migrate deploy failed; clearing failed settlement migration record if present (P3009 recovery)..."
  npx prisma migrate resolve --rolled-back 20260417180000_vprok_order_settlement 2>/dev/null || true
  npx prisma migrate deploy
fi

exec "$@"
