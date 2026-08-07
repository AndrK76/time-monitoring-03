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
    display_name  VARCHAR(255),
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
    provider_data TEXT,
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
