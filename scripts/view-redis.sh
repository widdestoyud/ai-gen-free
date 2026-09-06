#!/usr/bin/env bash
# scripts/view-redis.sh
# Script untuk melihat seluruh kunci dan isi data Redis di container (Git Bash / Linux)

echo "=== Memeriksa Kunci Redis ==="
docker compose exec redis redis-cli KEYS "*"

echo -e "\n=== Detail Rate Limit Keys ==="
docker compose exec redis redis-cli KEYS "ratelimit:*" || true
