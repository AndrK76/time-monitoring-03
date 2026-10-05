ALTER TABLE macroscop_evt_agent_configs
    ADD COLUMN event_mode VARCHAR(255);

UPDATE macroscop_evt_agent_configs
    SET event_mode = 'byMovingDetector'
    WHERE event_mode IS NULL;

ALTER TABLE macroscop_evt_agent_configs
    ALTER COLUMN event_mode SET NOT NULL;