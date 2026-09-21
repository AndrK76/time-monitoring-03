package ru.igorit.monitoring.admin.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;
import ru.igorit.monitoring.lib.dto.evt.*;
import ru.igorit.monitoring.lib.enums.EvtAgentType;
import ru.igorit.monitoring.lib.persistence.entity.crm.EvtAgentListProjection;
import ru.igorit.monitoring.lib.persistence.entity.evt.EvtAgent;
import ru.igorit.monitoring.lib.persistence.entity.evt.EvtAgentConfig;
import ru.igorit.monitoring.lib.persistence.entity.evt.EvtPlace;

@Mapper(componentModel = "spring")
public interface EvtModelMapper {

    @Mapping(target = "value", expression = "java(evtAgentType.name())")
    @Mapping(target = "name", source = "name")
    @Mapping(target = "description", source = "description")
    EvtAgentTypeDto toDto(EvtAgentType evtAgentType);

    @Mapping(target = "organizationId", source = "organization.id")
    @Mapping(target = "agentType", source = "type")
    EvtAgentListDto toListDto(EvtAgentListProjection item);

    @Mapping(target = "organizationId", source = "organization.id")
    @Mapping(target = "agentType", source = "item", qualifiedByName = "agentTypeToString")
    EvtAgentItemDto toDto(EvtAgent item);

    @Mapping(target = "agentType", source = "item.agent", qualifiedByName = "agentTypeToString")
    EvtAgentConfigDto toDto(EvtAgentConfig item);

    EvtPlaceListDto toDto(EvtPlace item);


    @Named("agentTypeToString")
    default String agentTypeToString(EvtAgent agent) {
        return agent.getType() != null ? agent.getType().name() : null;
    }
}
