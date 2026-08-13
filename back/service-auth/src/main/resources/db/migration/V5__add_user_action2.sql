ALTER TABLE user_roles ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE user_roles ADD COLUMN created_by VARCHAR(36);
ALTER TABLE user_roles ADD COLUMN updated_at TIMESTAMP;
ALTER TABLE user_roles ADD COLUMN updated_by VARCHAR(36);
UPDATE user_roles SET created_by = 'ffffffff-ffff-ffff-ffff-ffffffffffff' WHERE created_by IS NULL;