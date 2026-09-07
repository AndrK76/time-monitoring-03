ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS crm_agent_set boolean not null default false,
    ADD COLUMN IF NOT EXISTS events_agents_set boolean not null default false,
    ADD COLUMN IF NOT EXISTS camera_agents_set boolean not null default false
;
