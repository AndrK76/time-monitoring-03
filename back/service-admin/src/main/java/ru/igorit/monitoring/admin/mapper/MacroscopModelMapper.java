package ru.igorit.monitoring.admin.mapper;

import org.mapstruct.Mapper;
import ru.igorit.monitoring.lib.dto.macroscop.MacroscopAgentConfigDto;
import ru.igorit.monitoring.lib.dto.macroscop.MacroscopCredentialsDto;
import ru.igorit.monitoring.lib.dto.macroscop.MacroscopEvtAgentConfigDto;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopAgentConfig;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopCredentials;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopEvtAgentConfig;

@Mapper(componentModel = "spring")
public interface MacroscopModelMapper {
    MacroscopCredentialsDto toDto(MacroscopCredentials item);

    MacroscopCredentials fromDto(MacroscopCredentialsDto dto);

    MacroscopAgentConfigDto toDto(MacroscopAgentConfig item);

    MacroscopEvtAgentConfigDto toDto (MacroscopEvtAgentConfig item);


}
