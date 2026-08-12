package ru.igorit.monitoring.security.model;

import lombok.Getter;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Getter
public class JwtAuthenticationToken implements Authentication {

    private final String userId;
    private final String username;
    private final String token;
    private final List<String> roles;
    private final List<String> permissions;
    private final List<String> allowedOrganizations;
    private final Collection<? extends GrantedAuthority> authorities;
    private boolean authenticated = true;

    public JwtAuthenticationToken(String userId, String username,
                                  List<String> roles, List<String> permissions, List<String> allowedOrganizations,
                                  String token) {
        this.userId = userId;
        this.username = username;
        this.roles = roles != null ? roles : List.of();
        this.permissions = permissions != null ? permissions : List.of();
        this.allowedOrganizations = allowedOrganizations != null ? allowedOrganizations : List.of();
        this.token = token;

        // Объединяем роли и права в authorities
        this.authorities = Stream.concat(
                this.roles.stream().map(SimpleGrantedAuthority::new),
                this.permissions.stream().map(SimpleGrantedAuthority::new)
        ).collect(Collectors.toList());
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public Object getCredentials() {
        return token;
    }

    @Override
    public Object getDetails() {
        return null;
    }

    @Override
    public Object getPrincipal() {
        return userId;
    }

    @Override
    public boolean isAuthenticated() {
        return authenticated;
    }

    @Override
    public void setAuthenticated(boolean isAuthenticated) throws IllegalArgumentException {
        this.authenticated = isAuthenticated;
    }

    @Override
    public String getName() {
        return username;
    }

    /**
     * Проверка наличия роли
     */
    public boolean hasRole(String role) {
        String normalizedRole = role.startsWith("ROLE_") ? role : "ROLE_" + role;
        return roles.contains(normalizedRole);
    }

    /**
     * Проверка наличия права
     */
    public boolean hasPermission(String permission) {
        return permissions.contains(permission);
    }

    /**
     * Проверка наличия любого из прав
     */
    public boolean hasAnyPermission(String... permissions) {
        for (String perm : permissions) {
            if (this.permissions.contains(perm)) {
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
        return allowedOrganizations.contains(organizationId);
    }

    @Override
    public String toString() {
        return "JwtAuthenticationToken{" +
                "userId='" + userId + '\'' +
                ", username='" + username + '\'' +
                ", roles=" + roles +
                ", permissions=" + permissions +
                ", authenticated=" + authenticated +
                '}';
    }
}