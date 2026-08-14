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
    (gen_random_uuid()::text, 'DEVIATION_APPROVE', 'Подтверждение отклонений'),
    (gen_random_uuid()::text, 'USER_READ', 'Просмотр информации о пользователях'),
    (gen_random_uuid()::text, 'USER_WRITE', 'Изменение информации о пользователях')
ON CONFLICT (name) DO NOTHING;


-- ROLE_SYSTEM_ADMIN (Администратор системы) - все права
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'ROLE_SYSTEM_ADMIN'
ON CONFLICT DO NOTHING;

-- ROLE_ORG_ADMIN (Администратор организации) - USER_READ и DEVIATION_APPROVE
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'ROLE_ORG_ADMIN' and p.name in ('USER_READ', 'DEVIATION_APPROVE')
ON CONFLICT DO NOTHING;

-- ROLE_DISPATCHER (Диспетчер) - DEVIATION_APPROVE
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'ROLE_DISPATCHER'  AND p.name = 'DEVIATION_APPROVE'
ON CONFLICT DO NOTHING;

-- ============================================================
-- Пользователи (пароли пустые)
-- ============================================================

-- 1. Суперадмин (Администратор системы)
INSERT INTO users (id, username, email, display_name,
    first_name, last_name, is_active, is_email_verified, is_approved,
    created_by)
VALUES (
    gen_random_uuid()::text, 'superadmin', 'superadmin@none', 'Главный администратор',
    'Администратор', 'Главный', TRUE, TRUE, TRUE,
    'ffffffff-ffff-ffff-ffff-ffffffffffff'
) ON CONFLICT (username) DO NOTHING;

/*
-- 2. Админ (Администратор организации)
INSERT INTO users (id, username, email, display_name, first_name, last_name, is_active, is_email_verified)
VALUES (
    gen_random_uuid()::text,
    'admin',
    'admin@none',
    'Администратор организации',
    'Администратор',
    'Мелкий',
    TRUE,
    TRUE
) ON CONFLICT (username) DO NOTHING;

-- 3. Диспетчер 1
INSERT INTO users (id, username, email, display_name, first_name, last_name, is_active, is_email_verified)
VALUES (
    gen_random_uuid()::text,
    'dispatcher1',
    'dispatcher1@monitoring.local',
    'Диспетчер 1',
    'Диспетчер',
    'Первый',
    TRUE,
    TRUE
) ON CONFLICT (username) DO NOTHING;

-- 4. Диспетчер 2
INSERT INTO users (id, username, email, display_name, first_name, last_name, is_active, is_email_verified)
VALUES (
    gen_random_uuid()::text,
    'dispatcher2',
    'dispatcher2@monitoring.local',
    'Диспетчер 2',
    'Диспетчер',
    'Второй',
    TRUE,
    TRUE
) ON CONFLICT (username) DO NOTHING;
*/

-- ============================================================
-- Назначаем роли пользователям
-- ============================================================
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'superadmin' AND r.name = 'ROLE_SYSTEM_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'admin' AND r.name = 'ROLE_ORG_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id, created_by)
SELECT u.id, r.id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'
FROM users u, roles r
WHERE u.username in ('dispatcher1','dispatcher2') AND r.name = 'ROLE_DISPATCHER'
ON CONFLICT DO NOTHING;

-- ============================================================
-- Добавляем локальный провайдер
-- ============================================================
INSERT INTO user_auth_providers (id, user_id, provider_name, provider_user_id, provider_email, linked_at)
SELECT gen_random_uuid()::text, u.id, 'LOCAL', u.username, u.email, CURRENT_TIMESTAMP
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM user_auth_providers p
    WHERE p.user_id = u.id AND p.provider_name = 'LOCAL')
;


