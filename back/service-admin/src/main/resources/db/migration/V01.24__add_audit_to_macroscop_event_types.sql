ALTER TABLE macroscop_event_types
    ADD COLUMN created_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE macroscop_event_types
    ADD COLUMN created_by VARCHAR(255);

ALTER TABLE macroscop_event_types
    ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE macroscop_event_types
    ADD COLUMN updated_by VARCHAR(255);