package ru.igorit.monitoring.admin.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;
import ru.igorit.monitoring.lib.dto.img.*;
import ru.igorit.monitoring.lib.enums.ImgAgentType;
import ru.igorit.monitoring.lib.persistence.entity.img.ImgAgent;
import ru.igorit.monitoring.lib.persistence.entity.img.ImgAgentConfig;
import ru.igorit.monitoring.lib.persistence.entity.img.ImgAgentListProjection;
import ru.igorit.monitoring.lib.persistence.entity.img.ImgPlace;

@Mapper(componentModel = "spring")
public interface ImgModelMapper {

    @Mapping(target = "value", expression = "java(imgAgentType.name())")
    @Mapping(target = "name", source = "name")
    @Mapping(target = "description", source = "description")
    ImgAgentTypeDto toDto(ImgAgentType imgAgentType);

    @Mapping(target = "organizationId", source = "organization.id")
    @Mapping(target = "agentType", source = "type")
    ImgAgentListDto toListDto(ImgAgentListProjection item);

    @Mapping(target = "organizationId", source = "organization.id")
    @Mapping(target = "agentType", source = "item", qualifiedByName = "agentTypeToString")
    ImgAgentItemDto toDto(ImgAgent item);

    @Mapping(target = "agentType", source = "item.agent", qualifiedByName = "agentTypeToString")
    ImgAgentConfigDto toDto(ImgAgentConfig item);

    ImgPlaceListDto toListDto(ImgPlace item);


    @Named("agentTypeToString")
    default String agentTypeToString(ImgAgent agent) {
        return agent.getType() != null ? agent.getType().name() : null;
    }
}
