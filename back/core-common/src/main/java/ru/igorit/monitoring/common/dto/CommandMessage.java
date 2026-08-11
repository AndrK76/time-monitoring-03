// core-common/src/main/java/ru/igorit/monitoring/common/dto/CommandMessage.java
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
import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CommandMessage implements Serializable {

    private static final long serialVersionUID = 1L;

    private String commandId;
    private String commandType;
    private Object payload;

    // Информация о пользователе (для быстрого доступа)
    private UserContext userContext;

    // Полный SecurityContext (для восстановления)
    private SecurityContextDto securityContext;

    // Метаданные
    private LocalDateTime timestamp;
    private String sourceService;
    private String correlationId;
    private String signature;

    /**
     * Создание команды с текущим SecurityContext
     */
    public static CommandMessage createWithSecurityContext(String commandType, Object payload, String sourceService) {
        SecurityContext context = SecurityContextHolder.getContext();
        Authentication auth = context.getAuthentication();

        return CommandMessage.builder()
                .commandId(UUID.randomUUID().toString())
                .commandType(commandType)
                .payload(payload)
                .userContext(extractUserContext(auth))
                .securityContext(SecurityContextDto.fromSecurityContext(context))
                .timestamp(LocalDateTime.now())
                .sourceService(sourceService)
                .correlationId(UUID.randomUUID().toString())
                .build();
    }

    /**
     * Создание системной команды (без пользователя)
     */
    public static CommandMessage createSystemCommand(String commandType, Object payload) {
        return CommandMessage.builder()
                .commandId(UUID.randomUUID().toString())
                .commandType(commandType)
                .payload(payload)
                .userContext(UserContext.system())
                .timestamp(LocalDateTime.now())
                .sourceService(System.getProperty("spring.application.name", "unknown-service"))
                .correlationId(UUID.randomUUID().toString())
                .build();
    }

    /**
     * Извлечение контекста пользователя из Authentication
     */
    private static UserContext extractUserContext(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return UserContext.anonymous();
        }

        String userId = extractUserIdFromAuthentication(auth);
        String email = extractEmailFromAuthentication(auth);
        String firstName = extractFirstNameFromAuthentication(auth);
        String lastName = extractLastNameFromAuthentication(auth);

        return UserContext.builder()
                .userId(userId)
                .username(auth.getName())
                .email(email)
                .firstName(firstName)
                .lastName(lastName)
                .roles(extractRoles(auth))
                .permissions(extractPermissions(auth))
                .authenticated(true)
                .build();
    }

    /**
     * Извлечение userId из Authentication через рефлексию
     */
    private static String extractUserIdFromAuthentication(Authentication auth) {
        Object principal = auth.getPrincipal();

        if (principal instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> principalMap = (Map<String, Object>) principal;
            Object userId = principalMap.get("userId");
            return userId != null ? userId.toString() : null;
        }

        if (principal instanceof String) {
            return (String) principal;
        }

        try {
            Method method = principal.getClass().getMethod("getUserId");
            Object result = method.invoke(principal);
            return result != null ? result.toString() : null;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Извлечение email из Authentication через рефлексию
     */
    private static String extractEmailFromAuthentication(Authentication auth) {
        Object principal = auth.getPrincipal();
        try {
            Method method = principal.getClass().getMethod("getEmail");
            Object result = method.invoke(principal);
            return result != null ? result.toString() : null;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Извлечение firstName из Authentication через рефлексию
     */
    private static String extractFirstNameFromAuthentication(Authentication auth) {
        Object principal = auth.getPrincipal();
        try {
            Method method = principal.getClass().getMethod("getFirstName");
            Object result = method.invoke(principal);
            return result != null ? result.toString() : null;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Извлечение lastName из Authentication через рефлексию
     */
    private static String extractLastNameFromAuthentication(Authentication auth) {
        Object principal = auth.getPrincipal();
        try {
            Method method = principal.getClass().getMethod("getLastName");
            Object result = method.invoke(principal);
            return result != null ? result.toString() : null;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Извлечение ролей из Authentication
     */
    private static String extractRoles(Authentication auth) {
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(role -> role.startsWith("ROLE_"))
                .collect(Collectors.joining(","));
    }

    /**
     * Извлечение прав из Authentication
     */
    private static String extractPermissions(Authentication auth) {
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(permission -> !permission.startsWith("ROLE_"))
                .collect(Collectors.joining(","));
    }
}