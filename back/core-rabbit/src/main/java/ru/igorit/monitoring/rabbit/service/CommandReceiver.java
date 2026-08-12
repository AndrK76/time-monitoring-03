// core-rabbit/src/main/java/ru/igorit/monitoring/rabbit/service/CommandReceiver.java
package ru.igorit.monitoring.rabbit.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import ru.igorit.monitoring.common.dto.CommandMessage;
import ru.igorit.monitoring.common.dto.SecurityContextDto;
import ru.igorit.monitoring.common.dto.UserContext;
import ru.igorit.monitoring.security.mapper.SecurityContextMapper;

@Service
@Slf4j
public class CommandReceiver {

    private final ObjectMapper objectMapper;
    private final SecurityContextMapper securityContextMapper;

    public CommandReceiver(
            @Qualifier("rabbitMQObjectMapper") ObjectMapper objectMapper,
            SecurityContextMapper securityContextMapper
    ) {
        this.objectMapper = objectMapper;
        this.securityContextMapper = securityContextMapper;
    }

    public <T> T getPayload(CommandMessage command, Class<T> targetClass) {
        Object payload = command.getPayload();

        if (payload == null) {
            log.warn("Payload is null for command: {}", command.getCommandId());
            return null;
        }

        if (targetClass.isAssignableFrom(payload.getClass())) {
            return targetClass.cast(payload);
        }

        try {
            return objectMapper.convertValue(payload, targetClass);
        } catch (Exception e) {
            log.error("Failed to convert payload for command: {}", command.getCommandId(), e);
            throw new RuntimeException("Failed to convert payload", e);
        }
    }

    public UserContext getUserContext(CommandMessage command) {
        return command.getUserContext();
    }

    public SecurityContextDto getSecurityContext(CommandMessage command) {
        return command.getSecurityContext();
    }
}