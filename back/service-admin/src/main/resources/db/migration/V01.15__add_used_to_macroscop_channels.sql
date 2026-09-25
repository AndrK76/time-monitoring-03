ALTER TABLE macroscop_agent_channels
    ADD COLUMN use_channel BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE macroscop_agent_channels
    ALTER COLUMN use_channel DROP DEFAULT;
