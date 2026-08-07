-- ============================================================
-- Заполняем таблицу user_auth_providers для существующих пользователей
-- ============================================================

-- Вставляем записи для всех пользователей, у которых нет провайдера LOCAL
INSERT INTO user_auth_providers (
    id,
    user_id,
    provider_name,
    provider_user_id,
    provider_email,
    linked_at
)
SELECT
    gen_random_uuid()::text,
    u.id,
    'LOCAL',
    u.username,
    u.email,
    CURRENT_TIMESTAMP
FROM users u
WHERE NOT EXISTS (
    SELECT 1
    FROM user_auth_providers p
    WHERE p.user_id = u.id
      AND p.provider_name = 'LOCAL'
);

-- Проверка: сколько записей добавлено
DO $$
DECLARE
    inserted_count INT;
BEGIN
    SELECT COUNT(*) INTO inserted_count
    FROM user_auth_providers p
    JOIN users u ON u.id = p.user_id
    WHERE p.provider_name = 'LOCAL'
      AND p.provider_user_id = u.username;

    RAISE NOTICE 'Added % records to user_auth_providers for LOCAL provider', inserted_count;
END $$;