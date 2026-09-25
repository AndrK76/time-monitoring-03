ALTER TABLE macroscop_agent_configs
    ADD COLUMN server_id            VARCHAR(255),
    ADD COLUMN server_version       VARCHAR(64),
    ADD COLUMN info_response_time   TIMESTAMPTZ,
    ADD COLUMN server_tz            VARCHAR(16),
    ADD COLUMN server_use_tz        BOOLEAN;
