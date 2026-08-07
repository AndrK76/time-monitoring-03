#!/bin/bash

set -e

echo "========================================"
echo "  Initializing PostgreSQL schemas"
echo "  Container: ${CONTAINER_NAME}"
echo "  Network: ${NETWORK_NAME}"
echo "  Volume: ${VOLUME_NAME}"
echo "========================================"

# Чтение переменных окружения (с значениями по умолчанию)
AUTH_USER=${AUTH_USER}
AUTH_PASSWORD=${AUTH_PASSWORD}
AUTH_SCHEMA=${AUTH_SCHEMA}

MONITORING_USER=${MONITORING_USER}
MONITORING_PASSWORD=${MONITORING_PASSWORD}
MONITORING_SCHEMA=${MONITORING_SCHEMA}

ADMIN_USER=${ADMIN_USER}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_SCHEMA=${ADMIN_SCHEMA}

echo "Creating users..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Создание пользователей
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$AUTH_USER') THEN
            CREATE USER $AUTH_USER WITH PASSWORD '$AUTH_PASSWORD';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$MONITORING_USER') THEN
            CREATE USER $MONITORING_USER WITH PASSWORD '$MONITORING_PASSWORD';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$ADMIN_USER') THEN
            CREATE USER $ADMIN_USER WITH PASSWORD '$ADMIN_PASSWORD';
        END IF;
    END
    \$\$;

    -- Создание схем
    CREATE SCHEMA IF NOT EXISTS $AUTH_SCHEMA AUTHORIZATION $AUTH_USER;
    CREATE SCHEMA IF NOT EXISTS $MONITORING_SCHEMA AUTHORIZATION $MONITORING_USER;
    CREATE SCHEMA IF NOT EXISTS $ADMIN_SCHEMA AUTHORIZATION $ADMIN_USER;

    -- Настройка search_path
    ALTER ROLE $AUTH_USER SET search_path TO $AUTH_SCHEMA, public;
    ALTER ROLE $MONITORING_USER SET search_path TO $MONITORING_SCHEMA, public;
    ALTER ROLE $ADMIN_USER SET search_path TO $ADMIN_SCHEMA, public;

    -- Создание расширений
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;
EOSQL

echo "========================================"
echo "  Initialization completed!"
echo "========================================"
echo "  Auth user: $AUTH_USER"
echo "  Auth schema: $AUTH_SCHEMA"
echo "  Monitoring user: $MONITORING_USER"
echo "  Monitoring schema: $MONITORING_SCHEMA"
echo "  Admin user: $ADMIN_USER"
echo "  Admin schema: $ADMIN_SCHEMA"
echo "========================================"

# Проверка создания
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 
        nspname AS schema_name,
        nspowner::regrole AS owner
    FROM pg_namespace 
    WHERE nspname IN ('$AUTH_SCHEMA', '$MONITORING_SCHEMA', '$ADMIN_SCHEMA')
    ORDER BY nspname;

    SELECT usename, usesysid, usecreatedb 
    FROM pg_user 
    WHERE usename IN ('$AUTH_USER', '$MONITORING_USER', '$ADMIN_USER');
EOSQL