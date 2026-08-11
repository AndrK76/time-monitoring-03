package ru.igorit.monitoring.rabbit.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import ru.igorit.monitoring.common.dto.CommandMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class CommandReceiver {

    public CommandReceiver(@Qualifier("rabbitMQObjectMapper") ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    private final ObjectMapper objectMapper;



    /**
     * Извлекает payload из команды и преобразует его в указанный тип
     */
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
}