CREATE TABLE IF NOT EXISTS crm_organizations (
    id                  VARCHAR(255) PRIMARY KEY,
    type_discriminator  VARCHAR(255) NOT NULL,
    yc_id               BIGINT UNIQUE,
    yc_name             VARCHAR(2000)
);

CREATE TABLE IF NOT EXISTS crm_places (
    id                  VARCHAR(255) PRIMARY KEY,
    type_discriminator  VARCHAR(255) NOT NULL,
    name                VARCHAR(2000) NOT NULL,
    organization_id     VARCHAR(255),
    yc_id               BIGINT UNIQUE NOT NULL,
    yc_name             VARCHAR(2000)
);

CREATE TABLE IF NOT EXISTS crm_agents (
    id                  VARCHAR(255) PRIMARY KEY,
    type_discriminator  VARCHAR(255) NOT NULL,
    organization_id     VARCHAR(255) UNIQUE,
    agent_type          VARCHAR(255) NOT NULL,
    name                VARCHAR(2000) NOT NULL,
    description         TEXT,
    is_configured       BOOLEAN NOT NULL DEFAULT FALSE,
    crm_organization_id     VARCHAR(255) UNIQUE
);

CREATE TABLE IF NOT EXISTS crm_agent_configs (
    id                  VARCHAR(255) PRIMARY KEY
        CONSTRAINT fk_crm_agent_configs_agent
        REFERENCES crm_agents(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS yc_agent_configs (
    id                  VARCHAR(255) PRIMARY KEY
        CONSTRAINT fk_yc_agent_configs_config
        REFERENCES crm_agent_configs(id)
        ON DELETE CASCADE,
    api_url             VARCHAR(255) NOT NULL,
    partner_token       VARCHAR(255) NOT NULL,
    user_token          VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS yc_service_categories (
    yc_id               BIGINT PRIMARY KEY,
    yc_name             VARCHAR(2000),
    agent_id            VARCHAR(255),
    organization_id     VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS crm_services (
    id                  VARCHAR(255) PRIMARY KEY,
    type_discriminator  VARCHAR(255) NOT NULL,
    name                VARCHAR(2000) NOT NULL,
    agent_id            VARCHAR(255),
    yc_id               BIGINT UNIQUE NOT NULL,
    yc_name             VARCHAR(2000),
    service_category_id BIGINT
);


ALTER TABLE crm_places
    ADD CONSTRAINT fk_crm_places_organization
    FOREIGN KEY (organization_id)
    REFERENCES crm_organizations(id)
    ON DELETE CASCADE;

ALTER TABLE crm_agents
    ADD CONSTRAINT fk_crm_agents_organization
    FOREIGN KEY (crm_organization_id)
    REFERENCES crm_organizations(id)
    ON DELETE SET NULL;

 ALTER TABLE crm_agents
    ADD CONSTRAINT fk_crm_agents_common_organization
     FOREIGN KEY (organization_id)
    REFERENCES organizations(id)
    ON DELETE SET NULL;

ALTER TABLE yc_service_categories
    ADD CONSTRAINT fk_yc_service_categories_agent
    FOREIGN KEY (agent_id)
    REFERENCES crm_agents(id)
    ON DELETE CASCADE;

ALTER TABLE yc_service_categories
    ADD CONSTRAINT fk_yc_service_categories_organization
    FOREIGN KEY (organization_id)
    REFERENCES crm_organizations(id)
    ON DELETE CASCADE;

ALTER TABLE crm_services
    ADD CONSTRAINT fk_crm_services_agent
    FOREIGN KEY (agent_id)
    REFERENCES crm_agents(id)
    ON DELETE CASCADE;

ALTER TABLE crm_services
    ADD CONSTRAINT fk_crm_services_category
    FOREIGN KEY (service_category_id)
    REFERENCES yc_service_categories(yc_id)
    ON DELETE CASCADE;


CREATE INDEX idx_crm_places_organization_id ON crm_places(organization_id);
CREATE INDEX idx_crm_agents_organization_id ON crm_agents(organization_id);
CREATE INDEX idx_yc_service_categories_agent_id ON yc_service_categories(agent_id);
CREATE INDEX idx_yc_service_categories_organization_id ON yc_service_categories(organization_id);
CREATE INDEX idx_crm_services_agent_id ON crm_services(agent_id);
CREATE INDEX idx_crm_services_category_id ON crm_services(service_category_id);