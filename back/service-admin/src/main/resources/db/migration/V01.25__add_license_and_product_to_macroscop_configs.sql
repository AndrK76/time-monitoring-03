ALTER TABLE macroscop_agent_configs
    ADD COLUMN server_product VARCHAR(255);

ALTER TABLE macroscop_agent_configs
    ADD COLUMN license_end TIMESTAMP WITH TIME ZONE;

ALTER TABLE macroscop_agent_configs
    ADD COLUMN analytic_info VARCHAR(255);