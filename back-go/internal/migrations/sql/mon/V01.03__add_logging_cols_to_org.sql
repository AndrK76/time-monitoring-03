ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS created_by varchar(255) NULL,
    ADD COLUMN IF NOT EXISTS updated_at timestamp NULL,
    ADD COLUMN IF NOT EXISTS updated_by varchar(255) NULL;