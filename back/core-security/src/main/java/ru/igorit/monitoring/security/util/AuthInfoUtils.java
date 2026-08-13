package ru.igorit.monitoring.security.util;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import ru.igorit.monitoring.persistence.entity.User;
import ru.igorit.monitoring.security.model.JwtAuthenticationToken;
import ru.igorit.monitoring.security.model.UserPrincipal;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static ru.igorit.monitoring.common.AuthConstants.ANONYMOUS_USER;

public final class AuthInfoUtils {

    public static Authentication getCurrentAuth() {
      return SecurityContextHolder.getContext().getAuthentication();
    }

    public static String extractUserId(Authentication auth) {
        if (auth == null) {
            return User.anonymous().getId();
        }
        Object principal = auth.getPrincipal();

        if (principal instanceof UserPrincipal userPrincipal) {
            return userPrincipal.getUserId();
        }
        if (auth instanceof JwtAuthenticationToken token) {
            return token.getUserId();
        }
        if (principal instanceof String str) {
            if (str.matches("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")) {
                return str;
            } else if (ANONYMOUS_USER.equals(str)){
                return User.anonymous().getId();
            } else {
                //return str;
                return null;
            }
        }
        return extractStringFromPrincipal(principal, "userId", "getUserId");
    }

    public static String extractEmail(Authentication auth) {
        Object principal = auth.getPrincipal();

        if (principal instanceof UserPrincipal userPrincipal) {
            return userPrincipal.getEmail();
        }
        return extractStringFromPrincipal(principal, "email", "getEmail");
    }

    public static String extractFirstName(Authentication auth) {
        Object principal = auth.getPrincipal();
        if (principal instanceof UserPrincipal userPrincipal) {
            return userPrincipal.getFirstName();
        }
        return extractStringFromPrincipal(principal, "firstName", "getFirstName");
    }

    public static String extractLastName(Authentication auth) {
        Object principal = auth.getPrincipal();
        if (principal instanceof UserPrincipal userPrincipal) {
            return userPrincipal.getLastName();
        }
        return extractStringFromPrincipal(principal, "lastName", "getLastName");
    }

    public static String extractDisplayName(Authentication auth) {
        Object principal = auth.getPrincipal();
        if (principal instanceof UserPrincipal userPrincipal) {
            return userPrincipal.getDisplayName();
        }
        return extractStringFromPrincipal(principal, "displayName", "getDisplayName");
    }

    public static String extractRoles(Authentication auth) {
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(role -> role.startsWith("ROLE_"))
                .collect(Collectors.joining(","));
    }

    public static String extractPermissions(Authentication auth) {
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(permission -> !permission.startsWith("ROLE_"))
                .collect(Collectors.joining(","));
    }

    public static String extractAllowedOrganizationsAsString(Authentication auth) {
        Object principal = auth.getPrincipal();
        if (principal instanceof UserPrincipal userPrincipal) {
            List<String> orgs = userPrincipal.getAllowedOrganizations();
            return orgs != null ? String.join(",", orgs) : "";
        }
        if (auth instanceof JwtAuthenticationToken token) {
            List<String> orgs = token.getAllowedOrganizations();
            return orgs != null ? String.join(",", orgs) : "";
        }
        List<String> orgs = extractListFromPrincipal(principal, "allowedOrganizations", "getAllowedOrganizations");
        return orgs != null ? String.join(",", orgs) : "";
    }

    private static String extractStringFromPrincipal(Object principal, String mapKey, String methodName) {
        if (principal == null) {
            return null;
        }
        if (principal instanceof Map<?, ?> map) {
            Object value = map.get(mapKey);
            return value != null ? value.toString() : null;
        }
        try {
            Method method = principal.getClass().getMethod(methodName);
            Object result = method.invoke(principal);
            return result != null ? result.toString() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private static List<String> extractListFromPrincipal(Object principal, String mapKey, String methodName) {
        if (principal == null) {
            return List.of();
        }
        if (principal instanceof Map<?, ?> map) {
            Object value = map.get(mapKey);
            if (value instanceof List) {
                return ((List<?>) value).stream()
                        .map(Object::toString)
                        .collect(Collectors.toList());
            }
            return List.of();
        }
        try {
            Method method = principal.getClass().getMethod(methodName);
            Object result = method.invoke(principal);
            if (result instanceof List) {
                return ((List<?>) result).stream()
                        .map(Object::toString)
                        .collect(Collectors.toList());
            }
            return List.of();
        } catch (Exception e) {
            return List.of();
        }
    }


}