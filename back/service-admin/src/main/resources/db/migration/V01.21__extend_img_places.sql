ALTER TABLE img_places  ADD COLUMN present BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE img_places  ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE img_places  ADD COLUMN macroscop_channel_id VARCHAR(255);
ALTER TABLE img_places ADD COLUMN macroscop_internal_id VARCHAR(255);

ALTER TABLE img_places
    ADD CONSTRAINT uk_macroscop_img_places_channel UNIQUE (macroscop_channel_id);

ALTER TABLE img_places    ADD CONSTRAINT fk_macroscop_img_places_channel
        FOREIGN KEY (macroscop_channel_id) REFERENCES macroscop_agent_channels (id);