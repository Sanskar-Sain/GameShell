#!/usr/bin/env bash
# GameShell — dev-run: quick launch for development
set -euo pipefail

cd "$(dirname "$0")/.."

export NODE_ENV=development

# On Linux hybrid-GPU systems, optionally use dGPU
if [[ "${1:-}" == "--dgpu" ]]; then
  export DRI_PRIME=1
  echo "[dev-run] Using discrete GPU (DRI_PRIME=1)"
fi

echo "[dev-run] Starting GameShell in dev mode…"
npx electron . "$@"
