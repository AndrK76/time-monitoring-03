ALTER TABLE img_agent_configs
    DROP CONSTRAINT IF EXISTS uk_img_agent_configs_agent;

ALTER TABLE img_agent_configs
    DROP CONSTRAINT IF EXISTS fk_img_agent_configs_agent;

ALTER TABLE img_agent_configs
    DROP COLUMN IF EXISTS agent_id;

ALTER TABLE img_agent_configs
    ADD CONSTRAINT fk_img_agent_configs_agent
        FOREIGN KEY (id) REFERENCES img_agents (id) ON DELETE CASCADE;

DROP INDEX IF EXISTS idx_img_agent_configs_agent_id;