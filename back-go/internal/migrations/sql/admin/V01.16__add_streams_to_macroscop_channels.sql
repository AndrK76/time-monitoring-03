CREATE TABLE macroscop_channel_streams (
    channel_id    VARCHAR(255) NOT NULL,
    stream_order  INTEGER      NOT NULL,
    stream_type   VARCHAR(64),
    stream_format VARCHAR(32),
    CONSTRAINT pk_macroscop_channel_streams
        PRIMARY KEY (channel_id, stream_order),
    CONSTRAINT fk_macroscop_channel_streams_channel
        FOREIGN KEY (channel_id) REFERENCES macroscop_agent_channels (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_macroscop_channel_streams_channel
    ON macroscop_channel_streams (channel_id);
