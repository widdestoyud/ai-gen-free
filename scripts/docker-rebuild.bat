@echo off
REM scripts/docker-rebuild.bat
REM Script untuk rebuild image dan rerun docker compose di CMD / Windows.

echo === AI-GEN-FREE: Docker Rebuild ^& Rerun ===

echo.
echo [1/3] Status container saat ini:
docker compose ps

echo.
echo [2/3] Melakukan build image terbaru (api, web, worker, migrate)...
docker compose build api web worker migrate
if %ERRORLEVEL% neq 0 (
  echo Build docker gagal.
  exit /b %ERRORLEVEL%
)

echo.
echo [3/3] Menyalakan ulang container...
docker compose up -d --remove-orphans
if %ERRORLEVEL% neq 0 (
  echo Menyalakan container gagal.
  exit /b %ERRORLEVEL%
)

echo.
echo Status akhir container:
timeout /t 3 /nobreak >nul
docker compose ps

echo.
echo === Pembaruan Docker selesai! ===
echo Web UI   : http://localhost:3000
echo API      : http://localhost:4000/api/health
