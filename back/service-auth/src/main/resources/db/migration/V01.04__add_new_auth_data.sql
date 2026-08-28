-- ============================================================
-- Права (permissions)
-- ============================================================
INSERT INTO permissions (id, name, description) VALUES
    (gen_random_uuid()::text, 'SUPERUSER', 'Суперпользователь'),
    (gen_random_uuid()::text, 'ORG_WRITE', 'Изменение информации об организации')
ON CONFLICT (name) DO NOTHING;

-- ROLE_ORG_ADMIN (Администратор организации) - SUPERUSER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'ROLE_SYSTEM_ADMIN' and p.name in ('SUPERUSER')
ON CONFLICT DO NOTHING;

update permissions
set description='Просмотр информации о пользователях (в организации)'
where name = 'USER_READ';

update permissions
set description='Изменение информации о пользователях (в организации)'
where name = 'USER_WRITE';