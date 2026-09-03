package ru.igorit.monitoring.rabbit.service;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import ru.igorit.monitoring.common.dto.command.CommandMessageDto;
import ru.igorit.monitoring.common.dto.command.auth.SecurityContextDto;
import ru.igorit.monitoring.common.dto.command.auth.UserContextDto;
import ru.igorit.monitoring.common.enums.command.CommandMessageType;
import ru.igorit.monitoring.rabbit.config.RabbitMQCommonConfig;
import ru.igorit.monitoring.rabbit.config.RabbitMQConfigProperties;
import ru.igorit.monitoring.security.mapper.SecurityContextMapper;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class CommandSender {

    private final RabbitTemplate rabbitTemplate;
    private final SecurityContextMapper securityContextMapper;
    @Getter
    private final RabbitMQConfigProperties config;

    @Value("${spring.application.name:unknown-service}")
    private String serviceName;


    public void sendCommandToInternal(String routeKey, CommandMessageType commandType, Object payload) {
        UserContextDto userContextDto = securityContextMapper.toUserContextFromCurrent();
        SecurityContextDto securityContext = securityContextMapper.toDto(
                org.springframework.security.core.context.SecurityContextHolder.getContext()
        );

        CommandMessageDto command = CommandMessageDto.builder()
                .commandId(UUID.randomUUID().toString())
                .commandType(commandType.name())
                .payload(payload)
                .userContext(userContextDto)
                .securityContext(securityContext)
                .timestamp(LocalDateTime.now())
                .sourceService(serviceName)
                .correlationId(UUID.randomUUID().toString())
                .build();

        log.info("Sending command: {} from service: {} by user: {} to route: {}",
                commandType, serviceName, userContextDto.getUsername(), routeKey);

        rabbitTemplate.convertAndSend(config.getInternalExchange(), routeKey, command);
    }
}