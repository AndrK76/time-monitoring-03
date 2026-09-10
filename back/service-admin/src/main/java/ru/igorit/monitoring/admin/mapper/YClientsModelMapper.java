package ru.igorit.monitoring.admin.mapper;

import org.mapstruct.Mapper;
import ru.igorit.monitoring.lib.dto.yclients.YClientCredentialsDto;
import ru.igorit.monitoring.lib.dto.yclients.YClientsAgentConfigDto;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientCredentials;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsAgentConfig;

@Mapper(componentModel = "spring")
public interface YClientsModelMapper {
    YClientCredentialsDto toDto(YClientCredentials item);

    YClientCredentials fromDto(YClientCredentialsDto dto);


    YClientsAgentConfigDto toDto(YClientsAgentConfig item);

}
