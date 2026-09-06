# scripts/view-redis.ps1
# Script untuk melihat seluruh kunci dan isi data Redis di container

Write-Host "=== Memeriksa Kunci Redis ===" -ForegroundColor Cyan
docker compose exec redis redis-cli KEYS "*"

Write-Host "`n=== Detail Rate Limit & Session Keys ===" -ForegroundColor Yellow
$keys = docker compose exec redis redis-cli KEYS "ratelimit:*"
if ($keys) {
  Write-Host "Rate Limit Keys:" -ForegroundColor Green
  $keys
} else {
  Write-Host "Tidak ada kunci rate limit aktif." -ForegroundColor Gray
}
