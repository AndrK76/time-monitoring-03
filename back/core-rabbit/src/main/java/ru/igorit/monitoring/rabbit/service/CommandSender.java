// core-rabbit/src/main/java/ru/igorit/monitoring/rabbit/service/CommandSender.java
package ru.igorit.monitoring.rabbit.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import ru.igorit.monitoring.common.dto.CommandMessage;
import ru.igorit.monitoring.common.dto.SecurityContextDto;
import ru.igorit.monitoring.common.dto.UserContext;
import ru.igorit.monitoring.common.enums.CommandType;
import ru.igorit.monitoring.rabbit.config.RabbitMQConfig;
import ru.igorit.monitoring.security.mapper.SecurityContextMapper;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class CommandSender {

    private final RabbitTemplate rabbitTemplate;
    private final SecurityContextMapper securityContextMapper;

    @Value("${spring.application.name:unknown-service}")
    private String serviceName;

    public void sendCommand(CommandType commandType, Object payload) {
        UserContext userContext = securityContextMapper.toUserContextFromCurrent();
        SecurityContextDto securityContext = securityContextMapper.toDto(
                org.springframework.security.core.context.SecurityContextHolder.getContext()
        );

        CommandMessage command = CommandMessage.builder()
                .commandId(UUID.randomUUID().toString())
                .commandType(commandType.name())
                .payload(payload)
                .userContext(userContext)
                .securityContext(securityContext)
                .timestamp(LocalDateTime.now())
                .sourceService(serviceName)
                .correlationId(UUID.randomUUID().toString())
                .build();

        log.info("Sending command: {} from service: {} by user: {}",
                commandType, serviceName, userContext.getUsername());

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE_NAME,
                RabbitMQConfig.ROUTING_KEY,
                command
        );
    }
}