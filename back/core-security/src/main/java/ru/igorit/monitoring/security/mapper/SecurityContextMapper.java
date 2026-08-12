package ru.igorit.monitoring.security.mapper;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import ru.igorit.monitoring.common.dto.SecurityContextDto;
import ru.igorit.monitoring.common.dto.UserContext;
import ru.igorit.monitoring.security.model.JwtAuthenticationToken;
import ru.igorit.monitoring.security.model.UserPrincipal;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class SecurityContextMapper {

    // ============================================================
    // SecurityContext ↔ SecurityContextDto
    // ============================================================

    public SecurityContextDto toDto(SecurityContext context) {
        Authentication auth = context.getAuthentication();
        if (auth == null) {
            return SecurityContextDto.builder()
                    .authenticated(false)
                    .build();
        }

        return SecurityContextDto.builder()
                .principal(auth.getPrincipal() != null ? auth.getPrincipal().toString() : null)
                .credentials(auth.getCredentials() != null ? auth.getCredentials().toString() : null)
                .authorities(auth.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .collect(Collectors.toList()))
                .authenticated(auth.isAuthenticated())
                .name(auth.getName())
                .details(auth.getDetails() != null ? auth.getDetails().toString() : null)
                .build();
    }

    public SecurityContext toSecurityContext(SecurityContextDto dto) {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        if (dto == null || !dto.isAuthenticated()) {
            return context;
        }

        Authentication auth = new SecurityContextAuthentication(
                dto.getPrincipal(),
                dto.getCredentials(),
                dto.getAuthorities(),
                dto.isAuthenticated(),
                dto.getName(),
                dto.getDetails()
        );
        context.setAuthentication(auth);
        return context;
    }

    // ============================================================
    // Authentication → UserContext
    // ============================================================

    public UserContext toUserContext(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return UserContext.anonymous();
        }

        return UserContext.builder()
                .userId(extractUserId(auth))
                .username(auth.getName())
                .email(extractEmail(auth))
                .firstName(extractFirstName(auth))
                .lastName(extractLastName(auth))
                .displayName(extractDisplayName(auth))
                .roles(extractRoles(auth))
                .permissions(extractPermissions(auth))
                .allowedOrganizations(extractAllowedOrganizationsAsString(auth))
                .authenticated(true)
                .build();
    }

    public UserContext toUserContextFromCurrent() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return toUserContext(auth);
    }

    // ============================================================
    // Приватные методы извлечения данных из Authentication
    // ============================================================

    private String extractStringFromPrincipal(Object principal, String mapKey, String methodName) {
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

    private List<String> extractListFromPrincipal(Object principal, String mapKey, String methodName) {
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

    private String extractUserId(Authentication auth) {
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
            } else {
                //return str;
                return null;
            }
        }
        return extractStringFromPrincipal(principal, "userId", "getUserId");
    }

    private String extractEmail(Authentication auth) {
        Object principal = auth.getPrincipal();

        if (principal instanceof UserPrincipal userPrincipal) {
            return userPrincipal.getEmail();
        }
        return extractStringFromPrincipal(principal, "email", "getEmail");
    }

    private String extractFirstName(Authentication auth) {
        Object principal = auth.getPrincipal();
        if (principal instanceof UserPrincipal userPrincipal) {
            return userPrincipal.getFirstName();
        }
        return extractStringFromPrincipal(principal, "firstName", "getFirstName");
    }

    private String extractLastName(Authentication auth) {
        Object principal = auth.getPrincipal();
        if (principal instanceof UserPrincipal userPrincipal) {
            return userPrincipal.getLastName();
        }
        return extractStringFromPrincipal(principal, "lastName", "getLastName");
    }

    private String extractDisplayName(Authentication auth) {
        Object principal = auth.getPrincipal();
        if (principal instanceof UserPrincipal userPrincipal) {
            return userPrincipal.getDisplayName();
        }
        return extractStringFromPrincipal(principal, "displayName", "getDisplayName");
    }

    private String extractRoles(Authentication auth) {
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(role -> role.startsWith("ROLE_"))
                .collect(Collectors.joining(","));
    }

    private String extractPermissions(Authentication auth) {
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(permission -> !permission.startsWith("ROLE_"))
                .collect(Collectors.joining(","));
    }

    private String extractAllowedOrganizationsAsString(Authentication auth) {
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
}