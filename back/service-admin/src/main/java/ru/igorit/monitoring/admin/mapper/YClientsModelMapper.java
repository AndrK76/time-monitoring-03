package ru.igorit.monitoring.admin.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import ru.igorit.monitoring.lib.dto.yclients.*;
import ru.igorit.monitoring.lib.persistence.entity.yclients.*;

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

    @Mapping(target = "id", source = "YClientsId")
    @Mapping(target = "name", source = "YClientsName")
    @Mapping(target = "orgId", source = "organization.yclientsId")
    YClientsServiceCategoryListDto toDto(YClientsServiceCategory item);

    @Mapping(target = "categoryId", source = "serviceCategory.YClientsId")
    @Mapping(target = "ycId", source = "YClientsId")
    @Mapping(target = "ycName", source = "YClientsName")
    YClientsServiceDto toDto(YClientsService item);

}
