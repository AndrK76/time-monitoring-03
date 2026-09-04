INSERT INTO permissions (id, name, description, special) VALUES
    (gen_random_uuid()::text, 'ANY_ORG_ALLOW', 'Доступны все организации', true),
    (gen_random_uuid()::text, 'ANY_ACTION_ALLOW', 'Доступны все действия внутри организации',true)
ON CONFLICT (name) DO NOTHING;
