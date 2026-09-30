CREATE TABLE IF NOT EXISTS evt_agents (
    id                  VARCHAR(255) PRIMARY KEY,
    type_discriminator  VARCHAR(255) NOT NULL,
    organization_id     VARCHAR(255),
    agent_type          VARCHAR(255) NOT NULL,
    name                VARCHAR(2000) NOT NULL,
    description         TEXT,
    is_configured       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP,
    created_by          VARCHAR(255),
    updated_at          TIMESTAMP,
    updated_by          VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_evt_agents_organization_id
    ON evt_agents(organization_id);

ALTER TABLE evt_agents
    ADD CONSTRAINT fk_evt_agents_organization
    FOREIGN KEY (organization_id)
    REFERENCES organizations(id)
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS evt_agent_configs (
    id                  VARCHAR(255) PRIMARY KEY
        CONSTRAINT fk_evt_agent_configs_agent
        REFERENCES evt_agents(id)
        ON DELETE CASCADE,
    created_at          TIMESTAMP,
    created_by          VARCHAR(255),
    updated_at          TIMESTAMP,
    updated_by          VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS macroscop_agent_configs (
    id                  VARCHAR(255) PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    address             VARCHAR(255),
    login               VARCHAR(255),
    password            VARCHAR(255),
    created_at          TIMESTAMP,
    created_by          VARCHAR(255),
    updated_at          TIMESTAMP,
    updated_by          VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS macroscop_evt_agent_configs (
    id                  VARCHAR(255) PRIMARY KEY
        CONSTRAINT fk_macroscop_evt_agent_configs_config
        REFERENCES evt_agent_configs(id)
        ON DELETE CASCADE,
    config_id           VARCHAR(255) NOT NULL
        CONSTRAINT fk_macroscop_evt_agent_configs_macroscop
        REFERENCES macroscop_agent_configs(id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_macroscop_evt_agent_configs_config_id
    ON macroscop_evt_agent_configs(config_id);

CREATE TABLE IF NOT EXISTS evt_places (
    id                  VARCHAR(255) PRIMARY KEY,
    type_discriminator  VARCHAR(255) NOT NULL,
    name                VARCHAR(2000) NOT NULL,
    agent_id            VARCHAR(255) NOT NULL,
    available           BOOLEAN NOT NULL,
    created_at          TIMESTAMP,
    created_by          VARCHAR(255),
    updated_at          TIMESTAMP,
    updated_by          VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_evt_places_agent_id
    ON evt_places(agent_id);

ALTER TABLE evt_places
    ADD CONSTRAINT fk_evt_places_agent
    FOREIGN KEY (agent_id)
    REFERENCES evt_agents(id)
    ON DELETE CASCADE;