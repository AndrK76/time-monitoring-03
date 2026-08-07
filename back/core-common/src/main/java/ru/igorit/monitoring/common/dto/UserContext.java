package ru.igorit.monitoring.common.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserContext implements Serializable {

    private static final long serialVersionUID = 1L;

    private String userId;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private String roles;
    private String permissions;
    private String sessionId;
    private String ipAddress;
    private boolean authenticated;

    /**
     * Системный пользователь (для внутренних команд)
     */
    public static UserContext system() {
        return UserContext.builder()
                .userId("SYSTEM")
                .username("system")
                .roles("ROLE_SYSTEM")
                .permissions("ALL")
                .authenticated(true)
                .build();
    }

    /**
     * Анонимный пользователь (неаутентифицированный)
     */
    public static UserContext anonymous() {
        return UserContext.builder()
                .userId("ANONYMOUS")
                .username("anonymous")
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
}