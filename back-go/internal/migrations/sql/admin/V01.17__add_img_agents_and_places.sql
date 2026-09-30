CREATE TABLE img_agents (
    id                  VARCHAR(255) NOT NULL,
    organization_id     VARCHAR(255),
    agent_type          VARCHAR(255) NOT NULL,
    name                VARCHAR(2000) NOT NULL,
    description         TEXT,
    is_configured       BOOLEAN      NOT NULL DEFAULT FALSE,
    type_discriminator  VARCHAR(255) NOT NULL,
    created_at          TIMESTAMP,
    created_by          VARCHAR(255),
    updated_at          TIMESTAMP,
    updated_by          VARCHAR(255),
    CONSTRAINT pk_img_agents PRIMARY KEY (id),
    CONSTRAINT fk_img_agents_organization
        FOREIGN KEY (organization_id) REFERENCES organizations (id)
);

CREATE INDEX idx_img_agents_organization_id
    ON img_agents (organization_id);

CREATE INDEX idx_img_agents_type_discriminator
    ON img_agents (type_discriminator);


CREATE TABLE img_agent_configs (
    id                  VARCHAR(255) NOT NULL,
    agent_id            VARCHAR(255) NOT NULL,
    type_discriminator  VARCHAR(255) NOT NULL,
    created_at          TIMESTAMP,
    created_by          VARCHAR(255),
    updated_at          TIMESTAMP,
    updated_by          VARCHAR(255),
    CONSTRAINT pk_img_agent_configs PRIMARY KEY (id),
    CONSTRAINT uk_img_agent_configs_agent UNIQUE (agent_id),
    CONSTRAINT fk_img_agent_configs_agent
        FOREIGN KEY (agent_id) REFERENCES img_agents (id) ON DELETE CASCADE
);

CREATE INDEX idx_img_agent_configs_agent_id
    ON img_agent_configs (agent_id);


CREATE TABLE img_places (
    id                  VARCHAR(255) NOT NULL,
    name                VARCHAR(2000) NOT NULL,
    agent_id            VARCHAR(255) NOT NULL,
    available           BOOLEAN      NOT NULL DEFAULT TRUE,
    type_discriminator  VARCHAR(255) NOT NULL,
    created_at          TIMESTAMP,
    created_by          VARCHAR(255),
    updated_at          TIMESTAMP,
    updated_by          VARCHAR(255),
    CONSTRAINT pk_img_places PRIMARY KEY (id),
    CONSTRAINT fk_img_places_agent
        FOREIGN KEY (agent_id) REFERENCES img_agents (id) ON DELETE CASCADE
);

CREATE INDEX idx_img_places_agent_id
    ON img_places (agent_id);

CREATE INDEX idx_img_places_type_discriminator
    ON img_places (type_discriminator);