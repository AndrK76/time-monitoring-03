package ru.igorit.monitoring.lib.persistence.entity.crm;

public interface EvtAgentListProjection {
    String getId();

    String getName();

    String getDescription();

    boolean isConfigured();

    OrganizationInfo getOrganization();

    String getType();


    interface OrganizationInfo {
        String getId();
    }
}
