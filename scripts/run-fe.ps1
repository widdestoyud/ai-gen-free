# scripts/run-fe.ps1
# Script untuk menjalankan Frontend (FE) saja melalui Docker / pnpm

param(
  [switch]$Dev
)

if ($Dev) {
  Write-Host "=== Menjalankan Frontend (FE) Mode Dev (Live Reload) ===" -ForegroundColor Cyan
  pnpm --filter @ai-gen-free/web dev
} else {
  Write-Host "=== Menjalankan Container Frontend (FE) (Port 3000) ===" -ForegroundColor Cyan
  docker compose build web
  docker compose up -d web
  docker compose ps web
  Write-Host "`nFrontend Web UI berjalan di http://localhost:3000" -ForegroundColor Green
}
