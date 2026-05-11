#!/usr/bin/env bash
# Запускать на VPS из /opt/edem после обновления scripts/*.mjs и scripts/data/*.json
# Полная перезаливка DDX + догрузка X-Fit, World Class, Alex Fitness, Fitness House, Челябинск локальные.
set -euo pipefail
cd /opt/edem
for f in import-ddx-only.mjs import-xfit-clubs.mjs import-world-class-clubs.mjs import-alex-fitness-clubs.mjs import-fitness-house-clubs.mjs import-chelyabinsk-local-clubs.mjs; do
  docker cp "scripts/$f" edem-api:/app/scripts/"$f"
done
for f in ddx-clubs-real.json xfit-clubs.json world-class-clubs.json alex-fitness-clubs.json fitness-house-clubs.json chelyabinsk-local-clubs.json; do
  docker cp "scripts/data/$f" edem-api:/app/scripts/data/"$f"
done
docker compose -f /opt/edem/docker-compose.yml exec -T api sh -c \
  'node scripts/import-ddx-only.mjs && node scripts/import-xfit-clubs.mjs && node scripts/import-world-class-clubs.mjs && node scripts/import-alex-fitness-clubs.mjs && node scripts/import-fitness-house-clubs.mjs && node scripts/import-chelyabinsk-local-clubs.mjs'
echo "Restore finished."
