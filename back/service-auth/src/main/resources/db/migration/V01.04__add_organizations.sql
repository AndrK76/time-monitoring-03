CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(36) PRIMARY KEY,
    short_name VARCHAR(40) NOT NULL,
    full_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_organizations (
    user_id VARCHAR(36) NOT NULL,
    org_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (user_id, org_id),
    CONSTRAINT fk_user_org_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
