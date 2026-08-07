@echo off
REM docker-test/build.bat

docker-compose down
docker rmi mon3-mon-test mon3-admin-test mon3-nginx-frontend
docker builder prune -a -f


echo ========================================
echo   Building frontend Docker images
echo ========================================

cd /d %~dp0

echo [1/3] Building mon-test with prod configuration...
docker build -f mon-test/Dockerfile -t mon3-mon-test ..\ --no-cache
if errorlevel 1 (
    echo [ERROR] Failed to build mon-test
    pause
    exit /b 1
)

echo [2/3] Building admin-test with prod configuration...
docker build -f admin-test/Dockerfile -t mon3-admin-test ..\ --no-cache
if errorlevel 1 (
    echo [ERROR] Failed to build admin-test
    pause
    exit /b 1
)

echo [3/3] Building nginx-frontend...
rem docker build -f nginx-frontend/Dockerfile -t mon3-nginx-frontend .\ --no-cache
docker build -f nginx-frontend/Dockerfile -t mon3-nginx-frontend .\
if errorlevel 1 (
    echo [ERROR] Failed to build nginx-frontend
    pause
    exit /b 1
)

echo ========================================
echo   Build completed successfully!
echo ========================================
echo   Images:
echo   - mon3-mon-test
echo   - mon3-admin-test
echo   - mon3-nginx-frontend
echo ========================================
pause