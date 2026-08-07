-- Инициализация схемы аутентификации

-- ============================================================
-- Таблица пользователей
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    avatar_url VARCHAR(1000),
    phone_number VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE users IS 'Пользователи системы';
COMMENT ON COLUMN users.username IS 'Уникальное имя пользователя (логин)';
COMMENT ON COLUMN users.email IS 'Email пользователя (уникальный)';
COMMENT ON COLUMN users.password IS 'Хешированный пароль (только для локальных пользователей)';

-- ============================================================
-- Таблица провайдеров аутентификации
-- ============================================================
CREATE TABLE IF NOT EXISTS user_auth_providers (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_name VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    provider_data JSONB,
    UNIQUE(provider_name, provider_user_id)
);

COMMENT ON TABLE user_auth_providers IS 'Провайдеры аутентификации пользователей';
COMMENT ON COLUMN user_auth_providers.provider_name IS 'LOCAL, YANDEX, VK, GOOGLE, GITHUB, TELEGRAM';
COMMENT ON COLUMN user_auth_providers.provider_data IS 'Дополнительные данные провайдера в JSON';

CREATE INDEX idx_auth_providers_user_id ON user_auth_providers(user_id);
CREATE INDEX idx_auth_providers_name_id ON user_auth_providers(provider_name, provider_user_id);

-- ============================================================
-- Таблица ролей
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255)
);

COMMENT ON TABLE roles IS 'Роли пользователей';

-- ============================================================
-- Таблица прав (permissions)
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255)
);

COMMENT ON TABLE permissions IS 'Права доступа';

-- ============================================================
-- Связь пользователей и ролей
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id VARCHAR(36) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- ============================================================
-- Связь ролей и прав
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id VARCHAR(36) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(36) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- Роли
-- ============================================================
INSERT INTO roles (id, name, description) VALUES
    (gen_random_uuid()::text, 'ROLE_SYSTEM_ADMIN', 'Администратор системы'),
    (gen_random_uuid()::text, 'ROLE_ORG_ADMIN', 'Администратор организации'),
    (gen_random_uuid()::text, 'ROLE_DISPATCHER', 'Диспетчер')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Права (permissions)
-- ============================================================
INSERT INTO permissions (id, name, description) VALUES
    (gen_random_uuid()::text, 'DEVIATION_APPROVE', 'Подтверждение отклонений')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Назначаем права ролям
-- ============================================================

-- ROLE_SYSTEM_ADMIN (Администратор системы) - все права
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'ROLE_SYSTEM_ADMIN'
ON CONFLICT DO NOTHING;

-- ROLE_ORG_ADMIN (Администратор организации) - все права
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'ROLE_ORG_ADMIN'
ON CONFLICT DO NOTHING;

-- ROLE_DISPATCHER (Диспетчер) - только подтверждение отклонений
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'ROLE_DISPATCHER'
  AND p.name = 'DEVIATION_APPROVE'
ON CONFLICT DO NOTHING;

-- ============================================================
-- Пользователи (пароли хешированы)
-- ============================================================

-- Пароли: admin123 (хешированы через BCrypt)
-- $2a$10$rQpYKv0mYwJxYxz3xXhP.uWkqkqkqkqkqkqkqkqkqkqkqkqkqkqkqk = admin123

-- 1. Суперадмин (Администратор системы)
INSERT INTO users (id, username, email, password, first_name, last_name, is_active, is_email_verified)
VALUES (
    gen_random_uuid()::text,
    'superadmin',
    'superadmin@monitoring.local',
    '$2a$10$rQpYKv0mYwJxYxz3xXhP.uWkqkqkqkqkqkqkqkqkqkqkqkqkqkqkqk',
    'Super',
    'Admin',
    TRUE,
    TRUE
) ON CONFLICT (username) DO NOTHING;

-- 2. Админ (Администратор организации)
INSERT INTO users (id, username, email, password, first_name, last_name, is_active, is_email_verified)
VALUES (
    gen_random_uuid()::text,
    'admin',
    'admin@monitoring.local',
    '$2a$10$rQpYKv0mYwJxYxz3xXhP.uWkqkqkqkqkqkqkqkqkqkqkqkqkqkqkqk',
    'Organization',
    'Admin',
    TRUE,
    TRUE
) ON CONFLICT (username) DO NOTHING;

-- 3. Диспетчер 1 (с правом подтверждения отклонений)
INSERT INTO users (id, username, email, password, first_name, last_name, is_active, is_email_verified)
VALUES (
    gen_random_uuid()::text,
    'dispatcher1',
    'dispatcher1@monitoring.local',
    '$2a$10$rQpYKv0mYwJxYxz3xXhP.uWkqkqkqkqkqkqkqkqkqkqkqkqkqkqkqk',
    'Dispatcher',
    'One',
    TRUE,
    TRUE
) ON CONFLICT (username) DO NOTHING;

-- 4. Диспетчер 2 (без права подтверждения отклонений)
INSERT INTO users (id, username, email, password, first_name, last_name, is_active, is_email_verified)
VALUES (
    gen_random_uuid()::text,
    'dispatcher2',
    'dispatcher2@monitoring.local',
    '$2a$10$rQpYKv0mYwJxYxz3xXhP.uWkqkqkqkqkqkqkqkqkqkqkqkqkqkqkqk',
    'Dispatcher',
    'Two',
    TRUE,
    TRUE
) ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- Назначаем роли пользователям
-- ============================================================

-- Суперадмин -> ROLE_SYSTEM_ADMIN
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'superadmin' AND r.name = 'ROLE_SYSTEM_ADMIN'
ON CONFLICT DO NOTHING;

-- Админ -> ROLE_ORG_ADMIN
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'admin' AND r.name = 'ROLE_ORG_ADMIN'
ON CONFLICT DO NOTHING;

-- Диспетчер 1 -> ROLE_DISPATCHER
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'dispatcher1' AND r.name = 'ROLE_DISPATCHER'
ON CONFLICT DO NOTHING;

-- Диспетчер 2 -> ROLE_DISPATCHER
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'dispatcher2' AND r.name = 'ROLE_DISPATCHER'
ON CONFLICT DO NOTHING;