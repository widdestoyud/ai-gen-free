#!/usr/bin/env bash
# scripts/run-fe.sh
# Script untuk menjalankan Frontend (FE) saja melalui Docker / pnpm (Git Bash / Linux)

set -e

if [ "$1" == "--dev" ]; then
  echo "=== Menjalankan Frontend (FE) Mode Dev (Live Reload) ==="
  pnpm --filter @ai-gen-free/web dev
else
  echo "=== Menjalankan Container Frontend (FE) (Port 3000) ==="
  docker compose build web
  docker compose up -d web
  docker compose ps web
  echo -e "\nFrontend Web UI berjalan di http://localhost:3000"
fi
