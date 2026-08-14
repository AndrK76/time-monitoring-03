-- Добавление поддержки Telegram


-- ============================================================
-- Таблица токенов Telegram
-- ============================================================
CREATE TABLE IF NOT EXISTS telegram_tokens (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    token VARCHAR(255) NOT NULL UNIQUE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    telegram_user_id VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    target_url VARCHAR(1000)
);

COMMENT ON TABLE telegram_tokens IS 'Одноразовые токены для входа через Telegram';
COMMENT ON COLUMN telegram_tokens.token IS 'Уникальный токен доступа';
COMMENT ON COLUMN telegram_tokens.telegram_user_id IS 'ID пользователя в Telegram';

CREATE INDEX idx_telegram_tokens_token ON telegram_tokens(token);
CREATE INDEX idx_telegram_tokens_user_id ON telegram_tokens(user_id);
CREATE INDEX idx_telegram_tokens_expires_at ON telegram_tokens(expires_at);
CREATE INDEX idx_telegram_tokens_is_used ON telegram_tokens(is_used);

-- ============================================================
-- Добавляем индексы для производительности
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- ============================================================
-- Функция для автоматического обновления updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();