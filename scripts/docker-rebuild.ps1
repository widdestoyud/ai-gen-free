# scripts/docker-rebuild.ps1
# Script untuk rebuild image dan rerun docker compose dengan perubahan terbaru.

param(
  [switch]$NoCache
)

$ErrorActionPreference = "Stop"

Write-Host "=== AI-GEN-FREE: Docker Rebuild & Rerun ===" -ForegroundColor Cyan

# 1. Periksa Docker daemon
Write-Host "`n[1/4] Memeriksa status Docker daemon..." -ForegroundColor Yellow
try {
  $null = docker info 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker daemon tidak berjalan. Pastikan Docker Desktop aktif."
    exit 1
  }
} catch {
  Write-Error "Docker tidak terdeteksi di sistem."
  exit 1
}

# 2. Periksa container existing
Write-Host "`n[2/4] Container saat ini:" -ForegroundColor Yellow
docker compose ps

# 3. Build image terbaru (api, web, worker, migrate)
$buildArgs = @("compose", "build")
if ($NoCache) {
  $buildArgs += "--no-cache"
}
$buildArgs += @("api", "web", "worker", "migrate")

Write-Host "`n[3/4] Melakukan build image terbaru (api, web, worker, migrate)..." -ForegroundColor Yellow
& docker @buildArgs
if ($LASTEXITCODE -ne 0) {
  Write-Error "Build docker gagal."
  exit $LASTEXITCODE
}

# 4. Rerun container
Write-Host "`n[4/4] Menjalankan container terbaru..." -ForegroundColor Yellow
& docker compose up -d
if ($LASTEXITCODE -ne 0) {
  Write-Error "Menyalakan container gagal."
  exit $LASTEXITCODE
}

# Verifikasi status container
Write-Host "`nStatus container setelah pembaruan:" -ForegroundColor Yellow
Start-Sleep -Seconds 3
docker compose ps

Write-Host "`n=== Pembaruan Docker selesai! ===" -ForegroundColor Green
Write-Host "Web UI   : http://localhost:3000" -ForegroundColor Cyan
Write-Host "API      : http://localhost:4000/api/health" -ForegroundColor Cyan
