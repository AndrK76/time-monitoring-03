CREATE TABLE macroscop_event_types (
    id        VARCHAR(255) NOT NULL,
    name      VARCHAR(255),
    evt_type  VARCHAR(255),
    CONSTRAINT pk_macroscop_event_types PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_macroscop_event_types_evt_type
    ON macroscop_event_types (evt_type)
    WHERE evt_type IS NOT NULL;