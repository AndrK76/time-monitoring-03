package ru.igorit.monitoring.security.model;

import org.springframework.security.core.Authentication;

import java.util.List;

public interface MonAppAuthentication extends Authentication {
    boolean hasPermission(String permission);
    boolean hasAnyPermission(String... permissions);
    boolean isAllowedOrganization(String organizationId);
    List<String> getAllowedOrganizations();
}
