@echo off
cd /d %~dp0
docker-compose -p mon3 down
rem docker volume rm mon3-pg-data
rem docker volume rm mon3-rabbit-data
rem docker network rm mon3-net