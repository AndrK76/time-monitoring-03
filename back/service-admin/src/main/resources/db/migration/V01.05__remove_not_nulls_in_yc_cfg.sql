ALTER TABLE yc_agent_configs
    ALTER COLUMN api_url DROP NOT NULL,
    ALTER COLUMN partner_token DROP NOT NULL;