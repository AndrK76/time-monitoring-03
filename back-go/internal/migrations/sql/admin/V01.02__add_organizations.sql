CREATE TABLE organizations
(
    id                 VARCHAR(255) NOT NULL,
    short_name         VARCHAR(40)  NOT NULL,
    full_name          VARCHAR(255) NOT NULL,
    created_at         TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by         VARCHAR(255),
    updated_at         TIMESTAMP WITHOUT TIME ZONE,
    updated_by         VARCHAR(255),
    CONSTRAINT pk_organizations PRIMARY KEY (id)
);

CREATE TABLE user_organizations
(
    id                 VARCHAR(255) NOT NULL,
    organization_id    VARCHAR(255) NOT NULL,
    user_id            VARCHAR(255) NOT NULL,
    created_at         TIMESTAMP WITHOUT TIME ZONE,
    created_by         VARCHAR(255),
    CONSTRAINT pk_user_organizations PRIMARY KEY (id)
);

ALTER TABLE user_organizations  ADD CONSTRAINT uc_user_organizations UNIQUE(organization_id, user_id);

ALTER TABLE user_organizations  ADD CONSTRAINT fk_useorg_on_app_user FOREIGN KEY (user_id) REFERENCES app_users (id);

ALTER TABLE user_organizations  ADD CONSTRAINT fk_useorg_on_organization FOREIGN KEY (organization_id) REFERENCES organizations (id);