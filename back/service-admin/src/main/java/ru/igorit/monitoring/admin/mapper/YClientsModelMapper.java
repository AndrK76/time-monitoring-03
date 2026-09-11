package ru.igorit.monitoring.admin.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import ru.igorit.monitoring.lib.dto.yclients.YClientCredentialsDto;
import ru.igorit.monitoring.lib.dto.yclients.YClientsAgentConfigDto;
import ru.igorit.monitoring.lib.dto.yclients.YClientsOrganizationDto;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientCredentials;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsAgentConfig;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsOrganization;

@Mapper(componentModel = "spring")
public interface YClientsModelMapper {
    YClientCredentialsDto toDto(YClientCredentials item);

    YClientCredentials fromDto(YClientCredentialsDto dto);


    YClientsAgentConfigDto toDto(YClientsAgentConfig item);

    @Mapping(target = "places", ignore = true)
    @Mapping(target = "agentId", source = "agent.id")
    @Mapping(target = "ycId", source = "yclientsId")
    @Mapping(target = "timezone", source = "timeZone")
    YClientsOrganizationDto toDto(YClientsOrganization item);

}
