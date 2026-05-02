#!/bin/sh
set -e
echo "Applying Prisma migrations..."

run_migrate() {
  npx prisma migrate deploy
}

if ! run_migrate; then
  echo "migrate deploy failed; P3009 settlement recovery (one shot)..."
  npx prisma migrate resolve --rolled-back 20260417180000_vprok_order_settlement 2>/dev/null || true
  if ! run_migrate; then
    echo ""
    echo "=================================================================="
    echo "FATAL: prisma migrate deploy failed. Do not run API against this DB."
    echo "If you see 'must be owner of table', apply SQL as PostgreSQL superuser,"
    echo "then: npx prisma migrate resolve --applied <migration_folder_name>"
    echo "=================================================================="
    exit 1
  fi
fi

echo "Verifying migration history (no pending / failed migrations)..."
npx prisma migrate status

exec "$@"
