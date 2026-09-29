package ru.igorit.monitoring.lib.persistence.entity.img;

public interface ImgAgentListProjection {
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
