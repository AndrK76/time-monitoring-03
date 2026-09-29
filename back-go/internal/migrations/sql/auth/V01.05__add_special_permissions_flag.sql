ALTER TABLE permissions
    ADD COLUMN IF NOT EXISTS special BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE permissions set special=true where name = 'SUPERUSER';
