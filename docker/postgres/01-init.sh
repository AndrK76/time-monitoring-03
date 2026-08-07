#!/bin/bash

set -e

echo "========================================"
echo "  Initializing PostgreSQL schemas"
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
echo "  Initialization completed!"

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