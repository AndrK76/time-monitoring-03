@echo off
REM docker-test/stop.bat

echo ========================================
echo   Stopping frontend containers
echo ========================================

cd /d %~dp0

docker compose down

echo ========================================
echo   Containers stopped!
echo ========================================
pause