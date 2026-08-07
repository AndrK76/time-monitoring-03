-- Инициализация схемы администрирования

-- ============================================================
-- Пример таблиц для администрирования
-- ============================================================

-- Таблица логов администрирования
CREATE TABLE IF NOT EXISTS admin_logs (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(36) NOT NULL,
    username VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE admin_logs IS 'Логи действий администраторов';
COMMENT ON COLUMN admin_logs.action IS 'Действие: LOGIN, LOGOUT, USER_CREATE, USER_UPDATE, USER_DELETE, etc.';

CREATE INDEX idx_admin_logs_user_id ON admin_logs(user_id);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at);

-- ============================================================
-- Таблица системных настроек
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT,
    description VARCHAR(500),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE system_settings IS 'Системные настройки';

INSERT INTO system_settings (key, value, description) VALUES
    ('system.name', 'Monitoring3', 'Название системы'),
    ('system.version', '1.0.0', 'Версия системы'),
    ('system.maintenance', 'false', 'Режим обслуживания')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Таблица действий (для аудита)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_actions (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    action VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    requires_permission VARCHAR(100)
);

INSERT INTO audit_actions (action, description, requires_permission) VALUES
    ('USER_READ', 'Просмотр пользователей', 'USER_READ'),
    ('USER_WRITE', 'Редактирование пользователей', 'USER_WRITE'),
    ('USER_DELETE', 'Удаление пользователей', 'USER_DELETE'),
    ('ADMIN_ACCESS', 'Доступ к администрированию', 'ADMIN_ACCESS')
ON CONFLICT DO NOTHING;