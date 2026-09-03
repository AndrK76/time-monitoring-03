// service-admin/src/main/java/ru/igorit/monitoring/admin/listener/UserCommandListener.java
package ru.igorit.monitoring.auth.listener;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import ru.igorit.monitoring.auth.service.OrganizationEventsReceiveService;
import ru.igorit.monitoring.common.dto.command.CommandMessageDto;
import ru.igorit.monitoring.common.dto.command.auth.OrganizationInfoChangedEventCommandDto;
import ru.igorit.monitoring.common.enums.command.CommandMessageType;
import ru.igorit.monitoring.rabbit.service.CommandReceiver;

@Component
@RequiredArgsConstructor
@Slf4j
public class RabbitCommandListener {

    private final OrganizationEventsReceiveService organizationEventsService;
    private final CommandReceiver commandReceiver;

    @RabbitListener(queues = "#{rabbitMQConfigProperties.queueName}")
    public void handleCommands(CommandMessageDto command) {
        log.info("Received command: {} from {}", command.getCommandType(), command.getSourceService());

        try {
            switch (CommandMessageType.valueOf(command.getCommandType())) {
                case ORGANIZATION_INFO_CHANGED:
                    OrganizationInfoChangedEventCommandDto orgEvent = commandReceiver.getPayload(command, OrganizationInfoChangedEventCommandDto.class);
                    if (orgEvent != null) {
                        log.debug("Received organization info changed event: {}", orgEvent);
                        organizationEventsService.applyChangeEvent(orgEvent,command.getUserContext(),command.getSourceService());
                    }
                    break;

                default:
                    log.warn("Not processed command type: {}", command.getCommandType());
            }
        } catch (IllegalArgumentException e) {
            log.error("Unknown command type: {}", command.getCommandType(), e);
        } catch (Exception e) {
            log.error("Failed to process command: {}", command.getCommandId(), e);
        }
    }
}