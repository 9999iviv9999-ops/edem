#!/usr/bin/env bash
# На VPS: выставить в .env DATABASE_URL на общую БД vprok (таблицы ЭДЕМ уже в базе vprok на vprok-db).
# Пользователь БД: edem_app (роль есть в кластере vprok). Пароль: из строки EDEM_DB_PASSWORD в том же .env или edem_app_2026.
# Затем: cd /opt/edem && bash ops/vps-up.sh
set -euo pipefail
ENV_FILE="${1:-/opt/edem/.env}"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Нет файла ${ENV_FILE}" >&2
  exit 1
fi
PASS="$(grep -E '^EDEM_DB_PASSWORD=' "${ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
PASS="${PASS:-edem_app_2026}"
export EDEM_ENV_FILE="${ENV_FILE}"
export EDEM_APP_PASS="${PASS}"
cp -a "${ENV_FILE}" "${ENV_FILE}.bak.$(date +%s)"
python3 <<'PY'
import os, re
from pathlib import Path
import urllib.parse

env_path = Path(os.environ["EDEM_ENV_FILE"])
pw = os.environ["EDEM_APP_PASS"]
user = "edem_app"
url = f"postgresql://{user}:{urllib.parse.quote(pw, safe='')}@vprok-db:5432/vprok?schema=public"
text = env_path.read_text()
text = re.sub(r"^DATABASE_URL=.*", "DATABASE_URL=" + url, text, flags=re.M)
env_path.write_text(text)
print("OK:", env_path)
PY
