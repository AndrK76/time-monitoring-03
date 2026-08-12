package ru.igorit.monitoring.security.mapper;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;

public class SecurityContextAuthentication implements Authentication {

    private final Object principal;
    private final Object credentials;
    private final List<GrantedAuthority> authorities;
    private final boolean authenticated;
    private final String name;
    private final Object details;

    public SecurityContextAuthentication(Object principal, Object credentials,
                                         List<String> authorities, boolean authenticated,
                                         String name, Object details) {
        this.principal = principal;
        this.credentials = credentials;
        this.authorities = authorities.stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList());
        this.authenticated = authenticated;
        this.name = name;
        this.details = details;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public Object getCredentials() {
        return credentials;
    }

    @Override
    public Object getDetails() {
        return details;
    }

    @Override
    public Object getPrincipal() {
        return principal;
    }

    @Override
    public boolean isAuthenticated() {
        return authenticated;
    }

    @Override
    public void setAuthenticated(boolean isAuthenticated) throws IllegalArgumentException {
        // Нет операции — объект неизменяемый
    }

    @Override
    public String getName() {
        return name;
    }
}