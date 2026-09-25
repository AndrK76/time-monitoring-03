CREATE TABLE macroscop_agent_channels (
    id                VARCHAR(255) PRIMARY KEY,
    config_id         VARCHAR(255) NOT NULL,
    channel_id        VARCHAR(255) NOT NULL,
    channel_name      VARCHAR(255),
    device            VARCHAR(255),
    enabled           BOOLEAN      NOT NULL,
    exists_on_server  BOOLEAN      NOT NULL,
    archive_on        BOOLEAN      NOT NULL,
    archive_allow     BOOLEAN      NOT NULL,
    realtime_allow    BOOLEAN      NOT NULL,
    sound_allow       BOOLEAN      NOT NULL,
    archive_mode      VARCHAR(32),
    channel_tz        VARCHAR(16),
    created_at        TIMESTAMPTZ,
    created_by        VARCHAR(255),
    updated_at        TIMESTAMPTZ,
    updated_by        VARCHAR(255),
    CONSTRAINT fk_macroscop_channel_config
        FOREIGN KEY (config_id) REFERENCES macroscop_agent_configs (id)
);

CREATE INDEX ix_macroscop_channel_config
    ON macroscop_agent_channels (config_id);

CREATE UNIQUE INDEX ix_macroscop_channel_uid
    ON macroscop_agent_channels (config_id, channel_id);

