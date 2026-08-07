// core-common/src/main/java/ru/igorit/monitoring/common/dto/SecurityContextDto.java
package ru.igorit.monitoring.common.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.Serializable;
import java.util.List;
import java.util.stream.Collectors;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SecurityContextDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private String principal;
    private String credentials;
    private List<String> authorities;
    private boolean authenticated;
    private String name;
    private String details;

    /**
     * Создание DTO из SecurityContext
     */
    public static SecurityContextDto fromSecurityContext(SecurityContext context) {
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

    /**
     * Восстановление SecurityContext из DTO
     */
    public SecurityContext toSecurityContext() {
        SecurityContext context = SecurityContextHolder.createEmptyContext();

        if (!authenticated) {
            return context;
        }

        Authentication auth = new SecurityContextAuthentication(
                principal,
                credentials,
                authorities,
                authenticated,
                name,
                details
        );

        context.setAuthentication(auth);
        return context;
    }
}