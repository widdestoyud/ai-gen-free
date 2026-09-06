#!/usr/bin/env bash
# scripts/docker-rebuild.sh
# Script untuk rebuild image dan rerun docker compose di Linux/macOS/Git Bash.

set -e

echo "=== AI-GEN-FREE: Docker Rebuild & Rerun ==="

echo -e "\n[1/3] Status container saat ini:"
docker compose ps

echo -e "\n[2/3] Melakukan build image terbaru (api, web, worker, migrate)..."
docker compose build api web worker migrate

echo -e "\n[3/3] Menyalakan ulang container..."
docker compose up -d --remove-orphans

echo -e "\nStatus akhir container:"
sleep 3
docker compose ps

echo -e "\n=== Pembaruan Docker selesai! ==="
echo "Web UI   : http://localhost:3000"
echo "API      : http://localhost:4000/api/health"
