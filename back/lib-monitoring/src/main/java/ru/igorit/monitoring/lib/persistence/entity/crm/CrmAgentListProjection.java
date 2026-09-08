package ru.igorit.monitoring.lib.persistence.entity.crm;

import org.springframework.beans.factory.annotation.Value;

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
