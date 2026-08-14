package ru.igorit.monitoring.security.mapper;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import ru.igorit.monitoring.common.dto.command.auth.SecurityContextDto;
import ru.igorit.monitoring.common.dto.command.auth.UserContextDto;
import ru.igorit.monitoring.security.model.SecurityContextAuthentication;

import java.util.stream.Collectors;

import static ru.igorit.monitoring.security.util.AuthInfoUtils.*;

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

    public UserContextDto toUserContext(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return UserContextDto.anonymous();
        }

        return UserContextDto.builder()
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

    public UserContextDto toUserContextFromCurrent() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return toUserContext(auth);
    }



}