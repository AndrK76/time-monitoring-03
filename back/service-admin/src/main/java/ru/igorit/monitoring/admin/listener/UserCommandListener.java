// service-admin/src/main/java/ru/igorit/monitoring/admin/listener/UserCommandListener.java
package ru.igorit.monitoring.admin.listener;

import ru.igorit.monitoring.common.dto.UserInfoUpdatedEvent;
import ru.igorit.monitoring.rabbit.config.RabbitMQConfig;
import ru.igorit.monitoring.common.dto.CommandMessage;
import ru.igorit.monitoring.common.enums.CommandType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import ru.igorit.monitoring.admin.service.AdminUserCacheService;
import ru.igorit.monitoring.rabbit.service.CommandReceiver;

@Component
@RequiredArgsConstructor
@Slf4j
public class UserCommandListener {

    private final AdminUserCacheService cacheService;
    private final CommandReceiver commandReceiver;

    @RabbitListener(queues = RabbitMQConfig.QUEUE_NAME)
    public void handleUserUpdated(CommandMessage command) {
        log.info("Received command: {} from {}", command.getCommandType(), command.getSourceService());

        try {
            switch (CommandType.valueOf(command.getCommandType())) {
                case USER_INFO_UPDATED:
                    UserInfoUpdatedEvent userEvent = commandReceiver.getPayload(command, UserInfoUpdatedEvent.class);
                    if (userEvent != null) {
                        cacheService.updateUser(userEvent, command.getUserContext(), command.getSourceService());
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