@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul

echo ========================================
echo   Monitoring3 - PostgreSQL Start
echo ========================================
echo.

REM Определяем папку скрипта
set SCRIPT_DIR=%~dp0
set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%

pushd "%SCRIPT_DIR%" 2>nul
if errorlevel 1 (
    echo [ERROR] Cannot change to directory: %SCRIPT_DIR%
    pause
    exit /b 1
)

REM Проверка .env файла
if not exist .env (
    echo [ERROR] .env file not found!
    echo Please create .env file from .env.example
    pause
    exit /b 1
)

REM Загрузка переменных из .env
rem for /f "usebackq delims=" %%i in (`findstr /v "^#" .env ^| findstr /v "^$" 2^>nul`) do set %%i 2>nul
for /f "usebackq delims=" %%i in (".env") do set %%i

REM Проверка обязательных переменных
set MISSING_VARS=
if "%POSTGRES_DB%"=="" set MISSING_VARS=%MISSING_VARS% POSTGRES_DB
if "%POSTGRES_USER%"=="" set MISSING_VARS=%MISSING_VARS% POSTGRES_USER
if "%POSTGRES_PASSWORD%"=="" set MISSING_VARS=%MISSING_VARS% POSTGRES_PASSWORD
if "%CONTAINER_NAME%"=="" set MISSING_VARS=%MISSING_VARS% CONTAINER_NAME
if "%NETWORK_NAME%"=="" set MISSING_VARS=%MISSING_VARS% NETWORK_NAME
if "%VOLUME_NAME%"=="" set MISSING_VARS=%MISSING_VARS% VOLUME_NAME
if not "%MISSING_VARS%"=="" (
    echo [ERROR] Missing required variables in .env:
    echo %MISSING_VARS%
    pause
    exit /b 1
)

REM Показываем настройки
echo Configuration:
echo   Project:  %COMPOSE_PROJECT_NAME%
echo   Container: %CONTAINER_NAME%
echo   Port:     %POSTGRES_PORT%
echo   Database: %POSTGRES_DB%
echo   User:     %POSTGRES_USER%
echo.

REM Сборка образа
echo [1/3] Building image...
docker-compose -p %COMPOSE_PROJECT_NAME% build
if errorlevel 1 (
    echo [ERROR] Failed to build image!
    pause
    exit /b 1
)

REM Запуск контейнера
echo.
echo [2/3] Starting container...
docker-compose -p %COMPOSE_PROJECT_NAME% up -d postgres
if errorlevel 1 (
    echo [ERROR] Failed to start container!
    pause
    exit /b 1
)

REM Проверка статуса
REM ============================================================
echo.
echo [3/3] Checking status...
docker-compose -p %COMPOSE_PROJECT_NAME% ps
echo.
echo ========================================
echo   PostgreSQL started successfully!
echo ========================================
echo   Container: %CONTAINER_NAME%
echo   Port:      %POSTGRES_PORT%
echo   Database:  %POSTGRES_DB%
echo   User:      %POSTGRES_USER%
echo ========================================
echo.
echo   Connection string:
echo   jdbc:postgresql://localhost:%POSTGRES_PORT%/%POSTGRES_DB%
echo ========================================

popd
pause