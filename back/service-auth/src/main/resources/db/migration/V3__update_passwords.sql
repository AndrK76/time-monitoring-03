-- service-auth/src/main/resources/db/migration/V3__update_passwords.sql
-- Обновление паролей для всех пользователей (пароль: admin123)
-- BCrypt хеш: $2a$10$9sF6yJf8yXp.eGqZ5NKb2eYtUF3tFYh0Ae2i5pNgTpWYhAe2i5pNg


-- Обновляем пароли для всех существующих пользователей
UPDATE users
SET password = '$$2a$10$ouYL0bPOuegyelk0h2jwQeIVu5eoIco1S7Y2z1Mz3k9G3sEJCZ0ee'
WHERE username IN ('superadmin', 'admin', 'dispatcher1', 'dispatcher2')
  AND password IS NOT NULL;

-- Если у каких-то пользователей пароль NULL, тоже обновляем
UPDATE users
SET password = '$2a$10$ouYL0bPOuegyelk0h2jwQeIVu5eoIco1S7Y2z1Mz3k9G3sEJCZ0ee'
WHERE username IN ('superadmin', 'admin', 'dispatcher1', 'dispatcher2')
  AND password IS NULL;

-- Проверка: убеждаемся, что пароли обновились
SELECT username,
       LEFT(password, 20) as password_prefix,
       LENGTH(password) as password_length
FROM users
WHERE username IN ('superadmin', 'admin', 'dispatcher1', 'dispatcher2');