INSERT INTO permissions (id, name, description) VALUES
    (gen_random_uuid()::text, 'USER_READ', 'Просмотр информации о пользователях'),
    (gen_random_uuid()::text, 'USER_WRITE', 'Изменение информации о пользователях')
ON CONFLICT (name) DO NOTHING;

-- ROLE_SYSTEM_ADMIN — все права
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'ROLE_SYSTEM_ADMIN'
  AND p.name IN ('USER_READ', 'USER_WRITE')
ON CONFLICT DO NOTHING;

-- ROLE_ORG_ADMIN — только просмотр
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'ROLE_ORG_ADMIN'
  AND p.name = 'USER_READ'
ON CONFLICT DO NOTHING;