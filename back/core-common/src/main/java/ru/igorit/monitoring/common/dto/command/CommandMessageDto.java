package ru.igorit.monitoring.common.dto.command;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import ru.igorit.monitoring.common.dto.command.auth.SecurityContextDto;
import ru.igorit.monitoring.common.dto.command.auth.UserContextDto;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CommandMessageDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private String commandId;
    private String commandType;
    private Object payload;

    private UserContextDto userContext;
    private SecurityContextDto securityContext;

    private LocalDateTime timestamp;
    private String sourceService;
    private String correlationId;
    private String signature;

}