package ru.igorit.monitoring.lib.persistence.entity.evt;

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
