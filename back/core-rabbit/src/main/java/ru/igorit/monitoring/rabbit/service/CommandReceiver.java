// core-rabbit/src/main/java/ru/igorit/monitoring/rabbit/service/CommandReceiver.java
package ru.igorit.monitoring.rabbit.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import ru.igorit.monitoring.common.dto.command.CommandMessageDto;
import ru.igorit.monitoring.common.dto.command.auth.SecurityContextDto;
import ru.igorit.monitoring.common.dto.command.auth.UserContextDto;
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

    public <T> T getPayload(CommandMessageDto command, Class<T> targetClass) {
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

    public UserContextDto getUserContext(CommandMessageDto command) {
        return command.getUserContext();
    }

    public SecurityContextDto getSecurityContext(CommandMessageDto command) {
        return command.getSecurityContext();
    }
}