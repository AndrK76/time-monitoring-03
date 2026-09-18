package ru.igorit.monitoring.lib.persistence.entity.crm;

public interface CrmAgentListProjection {
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
