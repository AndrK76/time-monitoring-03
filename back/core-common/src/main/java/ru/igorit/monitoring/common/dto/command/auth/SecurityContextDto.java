// core-common/src/main/java/ru/igorit/monitoring/common/dto/SecurityContextDto.java
package ru.igorit.monitoring.common.dto.command.auth;

import lombok.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.Serial;
import java.io.Serializable;
import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SecurityContextDto implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private String principal;
    private String credentials;
    private List<String> authorities;
    private boolean authenticated;
    private String name;
    private String details;

    @Getter
    public static class ContextAuthentication implements Authentication {

        private final Object principal;
        private final Object credentials;
        private final List<GrantedAuthority> authorities;
        private final boolean authenticated;
        private final String name;
        private final Object details;

        public ContextAuthentication(Object principal, Object credentials,
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
        public void setAuthenticated(boolean isAuthenticated) throws IllegalArgumentException {
            // Нет операции - объект неизменяемый
        }

    }
}