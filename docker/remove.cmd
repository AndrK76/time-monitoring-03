@echo off

for /f "usebackq delims=" %%i in (`findstr /v "^#" .env ^| findstr /v "^$" 2^>nul`) do set %%i 2>nul

docker stop %CONTAINER_NAME%
docker rm %CONTAINER_NAME%
docker network rm %NETWORK_NAME%

docker volume rm %VOLUME_NAME%


rem pause