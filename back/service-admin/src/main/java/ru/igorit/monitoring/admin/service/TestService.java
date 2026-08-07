// service-admin/src/main/java/ru/igorit/monitoring/admin/service/TestService.java
package ru.igorit.monitoring.admin.service;

import ru.igorit.monitoring.admin.dto.TestResponse;
import ru.igorit.monitoring.security.model.JwtAuthenticationToken;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.stream.Collectors;

@Service
@Slf4j
public class TestService {

    public TestResponse getUserInfo(String action) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || !auth.isAuthenticated()) {
            return TestResponse.builder()
                    .message("Пользователь не аутентифицирован")
                    .success(false)
                    .timestamp(LocalDateTime.now())
                    .build();
        }

        String userId = null;
        String roles = "";
        String permissions = "";

        if (auth instanceof JwtAuthenticationToken) {
            JwtAuthenticationToken jwtAuth = (JwtAuthenticationToken) auth;
            userId = jwtAuth.getUserId();
            roles = String.join(", ", jwtAuth.getRoles());
            permissions = String.join(", ", jwtAuth.getPermissions());
        } else {
            roles = auth.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .filter(role -> role.startsWith("ROLE_"))
                    .collect(Collectors.joining(", "));
            permissions = auth.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .filter(perm -> !perm.startsWith("ROLE_"))
                    .collect(Collectors.joining(", "));
        }

        return TestResponse.builder()
                .message(action + " - успешно выполнено")
                .username(auth.getName())
                .userId(userId)
                .roles(roles)
                .permissions(permissions)
                .success(true)
                .timestamp(LocalDateTime.now())
                .build();
    }

    public TestResponse checkDeviationPermission() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || !auth.isAuthenticated()) {
            throw new AccessDeniedException("Пользователь не аутентифицирован");
        }

        boolean hasPermission = false;
        if (auth instanceof JwtAuthenticationToken) {
            JwtAuthenticationToken jwtAuth = (JwtAuthenticationToken) auth;
            hasPermission = jwtAuth.hasPermission("DEVIATION_APPROVE");
        } else {
            hasPermission = auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("DEVIATION_APPROVE"));
        }

        if (!hasPermission) {
            throw new AccessDeniedException("Требуется право DEVIATION_APPROVE");
        }

        return getUserInfo("Проверка права DEVIATION_APPROVE");
    }
}