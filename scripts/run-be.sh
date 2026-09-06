#!/usr/bin/env bash
# scripts/run-be.sh
# Script untuk menjalankan Backend (BE) saja melalui Docker / pnpm (Git Bash / Linux)

set -e

if [ "$1" == "--dev" ]; then
  echo "=== Menjalankan Backend (BE) Mode Dev (Live Reload) ==="
  pnpm --filter @ai-gen-free/api dev
else
  echo "=== Menjalankan Container Backend (BE) (Port 4000) ==="
  docker compose build api
  docker compose up -d api redis migrate
  docker compose ps api
  echo -e "\nBackend API berjalan di http://localhost:4000"
  echo "Health Check: http://localhost:4000/health"
fi
