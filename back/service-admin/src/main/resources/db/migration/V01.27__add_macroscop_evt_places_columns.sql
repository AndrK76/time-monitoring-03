
ALTER TABLE evt_places
    ADD COLUMN macroscop_channel_id      VARCHAR(255),
    ADD COLUMN macroscop_orig_channel_id VARCHAR(255),
    ADD COLUMN macroscop_zone_id         VARCHAR(255),
    ADD COLUMN macroscop_zone_name       VARCHAR(255),
    ADD COLUMN macroscop_zone_left       DOUBLE PRECISION,
    ADD COLUMN macroscop_zone_top        DOUBLE PRECISION,
    ADD COLUMN macroscop_zone_width      DOUBLE PRECISION,
    ADD COLUMN macroscop_zone_height     DOUBLE PRECISION;

ALTER TABLE evt_places
    ADD CONSTRAINT fk_macroscop_evt_places_channel
        FOREIGN KEY (macroscop_channel_id)
        REFERENCES macroscop_agent_channels (id);

CREATE INDEX ix_evt_places_macroscop_channel_id
    ON evt_places (macroscop_channel_id);