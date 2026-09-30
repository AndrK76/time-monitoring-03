CREATE TABLE macroscop_img_agent_configs (
    id          VARCHAR(255) NOT NULL,
    config_id   VARCHAR(255),
    CONSTRAINT pk_macroscop_img_agent_configs PRIMARY KEY (id),
    CONSTRAINT fk_macroscop_img_agent_configs_base
        FOREIGN KEY (id) REFERENCES img_agent_configs (id) ON DELETE CASCADE,
    CONSTRAINT fk_macroscop_img_agent_configs_config
        FOREIGN KEY (config_id) REFERENCES macroscop_agent_configs (id)
);

CREATE INDEX idx_macroscop_img_agent_configs_config_id
    ON macroscop_img_agent_configs (config_id);