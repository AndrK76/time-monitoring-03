package ru.igorit.monitoring.rabbit.service;

import org.springframework.beans.factory.annotation.Value;
import ru.igorit.monitoring.common.dto.CommandMessage;
import ru.igorit.monitoring.common.dto.UserUpdatedEvent;
import ru.igorit.monitoring.common.enums.CommandType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import ru.igorit.monitoring.rabbit.config.RabbitMQConfig;

@Service
@RequiredArgsConstructor
@Slf4j
public class CommandSender {

    private final RabbitTemplate rabbitTemplate;

    @Value("${spring.application.name:unknown-service}")
    private String serviceName;

    public void sendCommand(CommandType commandType, Object payload) {
        CommandMessage command = CommandMessage.createWithSecurityContext(
                commandType.name(), payload, serviceName);

        log.info("Sending command: {} from service: {}",
                commandType,
                command.getSourceService());

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE_NAME,
                RabbitMQConfig.ROUTING_KEY,
                command
        );
    }

    public void sendUserUpdatedEvent(UserUpdatedEvent event) {
        sendCommand(CommandType.USER_UPDATED, event);
    }
}