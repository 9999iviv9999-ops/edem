#!/usr/bin/env bash
# Run on the VPS from the machine that has the repo (Docker + optional Node for sync).
# Usage: GENESO_REPO=/path/to/edem-backend bash scripts/geneso-vps-docker-up.sh
set -euo pipefail

ROOT="${GENESO_REPO:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"

if [[ -f contracts/deployments/ethereum.json ]] && command -v node >/dev/null 2>&1; then
  node scripts/geneso-sync-nft-env.mjs
elif [[ -f contracts/deployments/ethereum.json ]]; then
  echo "[WARN] node not found — create nft-web/.env with VITE_* manually (see nft-web/.env.example)."
fi

cd nft-web
if [[ ! -f .env ]]; then
  cp .env.example .env
  if [[ -f ../contracts/deployments/ethereum.json ]] && command -v node >/dev/null 2>&1; then
    node ../scripts/geneso-sync-nft-env.mjs
  fi
fi

docker compose up -d --build
IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
echo "Geneso NFT container up. Try http://${IP:-127.0.0.1}:${GENESO_NFT_PORT:-8080}"
