package ru.igorit.monitoring.security.util;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import ru.igorit.monitoring.security.model.MonAppAuthentication;

import java.util.List;
import java.util.Optional;

@Component
public class SecurityAccessUtils {
    public static final String SUPERUSER_PERMISSION = "SUPERUSER";
    public static final String ANY_ORG_PERMISSION = "ANY_ORG_ALLOW";
    public static final String ANY_ACTION_PERMISSION = "ANY_ACTION_ALLOW";


    public List<String> getAllowedOrganizations() {
        return getAuth().map(MonAppAuthentication::getAllowedOrganizations).orElse(List.of());
    }

    public boolean hasPermission(String permission) {
        return getAuth().map(auth -> auth.hasPermission(permission)).orElse(false);
    }

    public boolean hasAnyPermission(String... permissions) {
        return getAuth().map(auth->auth.hasAnyPermission(permissions)).orElse(false);
    }

    public boolean isAllowedOrganization(String organizationId) {
        return getAuth().map(auth -> auth.isAllowedOrganization(organizationId)).orElse(false);
    }

    public boolean isAllowedAllActions() {
        return getAuth().map(auth->auth.hasAnyPermission(ANY_ACTION_PERMISSION,SUPERUSER_PERMISSION)).orElse(false);
    }

    public boolean isAllowedAllOrganizations() {
        return getAuth().map(auth->auth.hasAnyPermission(ANY_ORG_PERMISSION,SUPERUSER_PERMISSION)).orElse(false);
    }

    public boolean isSuperUser() {
        return getAuth().map(auth->auth.hasAnyPermission(SUPERUSER_PERMISSION)).orElse(false);
    }

    public boolean inSomeOrganization(List<String> organizations) {
        if (isAllowedAllOrganizations()) return true;
        return getAuth().map(auth->{
            List<String> allowed = auth.getAllowedOrganizations();
            if (allowed == null || allowed.isEmpty()) {
                return false;
            }
            return allowed.stream().anyMatch(organizations::contains);
        }).orElse(false);
    }


    private Optional<MonAppAuthentication> getAuth() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof MonAppAuthentication mAuth) {
            return Optional.of(mAuth);
        }
        return Optional.empty();
    }
}
