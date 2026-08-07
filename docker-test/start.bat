@echo off
REM docker-test/start.bat

docker exec mon3-mon-test cat /tmp/build-date.txt

echo ========================================
echo   Starting frontend containers
echo ========================================

cd /d %~dp0

docker-compose down
docker rmi -f mon3-mon-test mon3-admin-test mon3-nginx-frontend
docker builder prune -a -f

docker-compose build --no-cache
docker-compose up -d
docker exec mon3-mon-test cat /tmp/build-date.txt

echo ========================================
echo   Containers started!
echo ========================================
echo   mon-test:     http://crm.host:8888
echo   admin-test:   http://crm.host:8888/admin/
echo ========================================
pause