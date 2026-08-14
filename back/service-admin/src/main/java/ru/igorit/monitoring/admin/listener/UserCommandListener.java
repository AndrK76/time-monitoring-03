// service-admin/src/main/java/ru/igorit/monitoring/admin/listener/UserCommandListener.java
package ru.igorit.monitoring.admin.listener;

import ru.igorit.monitoring.admin.service.UserEventsReceiveService;
import ru.igorit.monitoring.common.dto.command.auth.UserCreatedEventCommandDto;
import ru.igorit.monitoring.common.dto.command.auth.UserInfoUpdatedEventCommandDto;
import ru.igorit.monitoring.rabbit.config.RabbitMQConfig;
import ru.igorit.monitoring.common.dto.command.CommandMessageDto;
import ru.igorit.monitoring.common.enums.command.CommandMessageType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import ru.igorit.monitoring.rabbit.service.CommandReceiver;

@Component
@RequiredArgsConstructor
@Slf4j
public class UserCommandListener {

    private final UserEventsReceiveService userService;
    private final CommandReceiver commandReceiver;

    @RabbitListener(queues = RabbitMQConfig.QUEUE_NAME)
    public void handleUserUpdated(CommandMessageDto command) {
        log.info("Received command: {} from {}", command.getCommandType(), command.getSourceService());

        try {
            switch (CommandMessageType.valueOf(command.getCommandType())) {
                case USER_INFO_UPDATED:
                    UserInfoUpdatedEventCommandDto userEvent = commandReceiver.getPayload(command, UserInfoUpdatedEventCommandDto.class);
                    if (userEvent != null) {
                        userService.updateUser(userEvent, command.getUserContext(), command.getSourceService());
                    }
                    break;
                case USER_CREATED:
                    UserCreatedEventCommandDto userCEvent = commandReceiver.getPayload(command, UserCreatedEventCommandDto.class);
                    if (userCEvent != null) {
                        userService.createUser(userCEvent,command.getUserContext(), command.getSourceService());
                    }
                    break;
                default:
                    log.warn("Unknown command type: {}", command.getCommandType());
            }
        } catch (IllegalArgumentException e) {
            log.error("Unknown command type: {}", command.getCommandType(), e);
        } catch (Exception e) {
            log.error("Failed to process command: {}", command.getCommandId(), e);
        }
    }
}