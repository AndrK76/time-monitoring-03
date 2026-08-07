// core-security/src/main/java/ru/igorit/monitoring/security/service/CommandSenderService.java
package ru.igorit.monitoring.security.service;

import ru.igorit.monitoring.common.dto.CommandMessage;
import ru.igorit.monitoring.common.dto.SecurityContextDto;
import ru.igorit.monitoring.common.dto.UserContext;
import ru.igorit.monitoring.common.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CommandSenderService {


//    private final RabbitTemplate rabbitTemplate;
//
//    /**
//     * Отправка команды в мониторинг сервис
//     */
//    public void sendToMonitoring(String commandType, Object payload) {
//        sendCommand(
//                RabbitMQConfig.MONITORING_EXCHANGE,
//                RabbitMQConfig.MONITORING_ROUTING_KEY,
//                commandType,
//                payload
//        );
//    }
//
//    /**
//     * Отправка команды в админ сервис
//     */
//    public void sendToAdmin(String commandType, Object payload) {
//        sendCommand(
//                RabbitMQConfig.ADMIN_EXCHANGE,
//                RabbitMQConfig.ADMIN_ROUTING_KEY,
//                commandType,
//                payload
//        );
//    }
//
//    /**
//     * Отправка команды с ожиданием ответа (синхронный вызов)
//     */
//    public Object sendAndReceive(String exchange, String routingKey, String commandType, Object payload) {
//        CommandMessage command = buildCommand(commandType, payload);
//        command.setCorrelationId(UUID.randomUUID().toString());
//
//        log.info("Sending command {} with correlationId: {}",
//                commandType, command.getCorrelationId());
//
//        return rabbitTemplate.convertSendAndReceive(
//                exchange,
//                routingKey,
//                command
//        );
//    }
//
//    /**
//     * Базовая отправка команды
//     */
//    private void sendCommand(String exchange, String routingKey, String commandType, Object payload) {
//        CommandMessage command = buildCommand(commandType, payload);
//
//        log.info("Sending command {} from user {} to {}",
//                commandType,
//                command.getUserContext().getUsername(),
//                routingKey);
//
//        rabbitTemplate.convertAndSend(
//                exchange,
//                routingKey,
//                command
//        );
//    }
//
//    /**
//     * Построение команды с текущим SecurityContext
//     */
//    private CommandMessage buildCommand(String commandType, Object payload) {
//        SecurityContext context = SecurityContextHolder.getContext();
//        Authentication auth = context.getAuthentication();
//
//        return CommandMessage.builder()
//                .commandId(UUID.randomUUID().toString())
//                .commandType(commandType)
//                .payload(payload)
//                .userContext(extractUserContext(auth))
//                .securityContext(SecurityContextDto.fromSecurityContext(context))
//                .timestamp(LocalDateTime.now())
//                .sourceService(System.getProperty("spring.application.name", "unknown-service"))
//                .correlationId(UUID.randomUUID().toString())
//                .build();
//    }
//
//    /**
//     * Извлечение контекста пользователя из Authentication
//     */
//    private UserContext extractUserContext(Authentication auth) {
//        if (auth == null || !auth.isAuthenticated()) {
//            return UserContext.anonymous();
//        }
//
//        return UserContext.builder()
//                .userId(extractUserId(auth))
//                .username(auth.getName())
//                .email(extractEmail(auth))
//                .firstName(extractFirstName(auth))
//                .lastName(extractLastName(auth))
//                .roles(extractRoles(auth))
//                .permissions(extractPermissions(auth))
//                .authenticated(true)
//                .build();
//    }
//
//    /**
//     * Извлечение userId из Authentication
//     */
//    private String extractUserId(Authentication auth) {
//        Object principal = auth.getPrincipal();
//        if (principal instanceof ru.igorit.monitoring.security.model.UserPrincipal) {
//            return ((ru.igorit.monitoring.security.model.UserPrincipal) principal).getUserId();
//        }
//        return null;
//    }
//
//    /**
//     * Извлечение email из Authentication
//     */
//    private String extractEmail(Authentication auth) {
//        Object principal = auth.getPrincipal();
//        if (principal instanceof ru.igorit.monitoring.security.model.UserPrincipal) {
//            return ((ru.igorit.monitoring.security.model.UserPrincipal) principal).getEmail();
//        }
//        return null;
//    }
//
//    /**
//     * Извлечение firstName из Authentication
//     */
//    private String extractFirstName(Authentication auth) {
//        Object principal = auth.getPrincipal();
//        if (principal instanceof ru.igorit.monitoring.security.model.UserPrincipal) {
//            return ((ru.igorit.monitoring.security.model.UserPrincipal) principal).getFirstName();
//        }
//        return null;
//    }
//
//    /**
//     * Извлечение lastName из Authentication
//     */
//    private String extractLastName(Authentication auth) {
//        Object principal = auth.getPrincipal();
//        if (principal instanceof ru.igorit.monitoring.security.model.UserPrincipal) {
//            return ((ru.igorit.monitoring.security.model.UserPrincipal) principal).getLastName();
//        }
//        return null;
//    }
//
//    /**
//     * Извлечение ролей из Authentication
//     */
//    private String extractRoles(Authentication auth) {
//        return auth.getAuthorities().stream()
//                .map(GrantedAuthority::getAuthority)
//                .filter(role -> role.startsWith("ROLE_"))
//                .collect(Collectors.joining(","));
//    }
//
//    /**
//     * Извлечение прав из Authentication
//     */
//    private String extractPermissions(Authentication auth) {
//        return auth.getAuthorities().stream()
//                .map(GrantedAuthority::getAuthority)
//                .filter(permission -> !permission.startsWith("ROLE_"))
//                .collect(Collectors.joining(","));
//    }
}