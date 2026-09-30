ALTER TABLE crm_agents
    ADD COLUMN created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN created_by varchar(255) NULL,
    ADD COLUMN updated_at timestamp NULL,
    ADD COLUMN updated_by varchar(255) NULL;

ALTER TABLE crm_organizations
    ADD COLUMN created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN created_by varchar(255) NULL,
    ADD COLUMN updated_at timestamp NULL,
    ADD COLUMN updated_by varchar(255) NULL;

ALTER TABLE crm_places
    ADD COLUMN created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN created_by varchar(255) NULL,
    ADD COLUMN updated_at timestamp NULL,
    ADD COLUMN updated_by varchar(255) NULL;

ALTER TABLE crm_services
    ADD COLUMN created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN created_by varchar(255) NULL,
    ADD COLUMN updated_at timestamp NULL,
    ADD COLUMN updated_by varchar(255) NULL;


ALTER TABLE crm_agent_configs
    ADD COLUMN created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN created_by varchar(255) NULL,
    ADD COLUMN updated_at timestamp NULL,
    ADD COLUMN updated_by varchar(255) NULL;

ALTER TABLE yc_service_categories
    ADD COLUMN created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN created_by varchar(255) NULL,
    ADD COLUMN updated_at timestamp NULL,
    ADD COLUMN updated_by varchar(255) NULL;