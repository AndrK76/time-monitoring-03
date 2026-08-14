package ru.igorit.monitoring.common.dto.command.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import static ru.igorit.monitoring.common.AuthConstants.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserContextDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private String userId;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private String displayName;
    private String roles;
    private String permissions;
    private String allowedOrganizations;
    private String sessionId;
    private String ipAddress;
    private boolean authenticated;

    /**
     * Системный пользователь (для внутренних команд)
     */
    public static UserContextDto system() {
        return UserContextDto.builder()
                .userId(SYSTEM_USERID)
                .username(SYSTEM_USER)
                //.roles("ROLE_SYSTEM")
                .permissions("ALL")
                .authenticated(true)
                .build();
    }

    /**
     * Анонимный пользователь (неаутентифицированный)
     */
    public static UserContextDto anonymous() {
        return UserContextDto.builder()
                .userId(ANONYMOUS_USERID)
                .username(ANONYMOUS_USER)
                .authenticated(false)
                .build();
    }

    /**
     * Проверка наличия роли
     */
    public boolean hasRole(String role) {
        if (roles == null || roles.isEmpty()) {
            return false;
        }
        String normalizedRole = role.startsWith("ROLE_") ? role : "ROLE_" + role;
        for (String r : roles.split(",")) {
            if (r.trim().equals(normalizedRole)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Проверка наличия права
     */
    public boolean hasPermission(String permission) {
        if (permissions == null || permissions.isEmpty()) {
            return false;
        }
        for (String p : permissions.split(",")) {
            if (p.trim().equals(permission)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Проверка наличия любой из ролей
     */
    public boolean hasAnyRole(String... roles) {
        for (String role : roles) {
            if (hasRole(role)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Проверка доступа к организации
     */
    public boolean isAllowedOrganization(String organizationId) {
        if (allowedOrganizations == null || allowedOrganizations.isEmpty()) {
            return false;
        }
        for (String org : allowedOrganizations.split(",")) {
            if (org.trim().equals(organizationId)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Получить доступные организации списком
     */
    public List<String> getAllowedOrganizationsList() {
        if (allowedOrganizations == null || allowedOrganizations.isEmpty()) {
            return List.of();
        }
        return Arrays.stream(allowedOrganizations.split(","))
                .map(String::trim)
                .collect(Collectors.toList());
    }
}