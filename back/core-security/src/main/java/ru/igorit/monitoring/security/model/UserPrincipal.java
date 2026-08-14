package ru.igorit.monitoring.security.model;

import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import ru.igorit.monitoring.persistence.entity.auth.User;

import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;

@Getter
public class UserPrincipal implements UserDetails {

    private final User user;
    private final Collection<? extends GrantedAuthority> authorities;
    private final List<String> allowedOrganizations;

    public UserPrincipal(User user) {
        this(user, List.of());
    }

    public UserPrincipal(User user, List<String> allowedOrganizations) {
        this.user = user;
        this.authorities = user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(permission -> new SimpleGrantedAuthority(permission.getName()))
                .collect(Collectors.toSet());
        this.allowedOrganizations = allowedOrganizations != null ? allowedOrganizations : List.of();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return user.getPassword();
    }

    @Override
    public String getUsername() {
        return user.getUsername();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return user.getIsActive();
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return user.getIsActive();
    }

    public String getUserId() {
        return user.getId();
    }

    public String getEmail() {
        return user.getEmail();
    }

    public String getFirstName() {
        return user.getFirstName();
    }

    public String getLastName() {
        return user.getLastName();
    }

    public String getDisplayName() {
        return user.getDisplayName();
    }
}