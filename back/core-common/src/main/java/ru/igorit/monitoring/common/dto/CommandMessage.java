// core-common/src/main/java/ru/igorit/monitoring/common/dto/CommandMessage.java
package ru.igorit.monitoring.common.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CommandMessage implements Serializable {

    private static final long serialVersionUID = 1L;

    private String commandId;
    private String commandType;
    private Object payload;

    private UserContext userContext;
    private SecurityContextDto securityContext;

    private LocalDateTime timestamp;
    private String sourceService;
    private String correlationId;
    private String signature;

    /**
     * Создание команды с контекстом из SecurityContextHolder.
     * Для использования требуется SecurityContextMapper.
     * Рекомендуется вызывать через фабрику в сервисах.
     */
    public static CommandMessageBuilder builderWithContext() {
        return builder();
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
}