# scripts/run-be.ps1
# Script untuk menjalankan Backend (BE) saja melalui Docker / pnpm

param(
  [switch]$Dev
)

if ($Dev) {
  Write-Host "=== Menjalankan Backend (BE) Mode Dev (Live Reload) ===" -ForegroundColor Cyan
  pnpm --filter @ai-gen-free/api dev
} else {
  Write-Host "=== Menjalankan Container Backend (BE) (Port 4000) ===" -ForegroundColor Cyan
  docker compose build api
  docker compose up -d api redis migrate
  docker compose ps api
  Write-Host "`nBackend API berjalan di http://localhost:4000" -ForegroundColor Green
  Write-Host "Health Check: http://localhost:4000/health" -ForegroundColor Green
}
