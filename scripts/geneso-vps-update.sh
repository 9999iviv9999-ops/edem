#!/usr/bin/env bash
# Run on the VPS after SSH (where the repo clone lives).
# Pulls latest main and rebuilds the Geneso NFT Docker image.
#
#   GENESO_REPO=/opt/edem-backend bash scripts/geneso-vps-update.sh
#
# If GENESO_REPO is omitted, uses the parent of this script (repo root).
set -euo pipefail

ROOT="${GENESO_REPO:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"

echo "[geneso-vps-update] repo: $ROOT"
git fetch origin --prune
git pull --ff-only origin "$(git rev-parse --abbrev-ref HEAD)"

exec bash scripts/geneso-vps-docker-up.sh
