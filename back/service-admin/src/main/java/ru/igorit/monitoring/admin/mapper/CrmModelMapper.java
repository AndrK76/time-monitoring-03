package ru.igorit.monitoring.admin.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;
import ru.igorit.monitoring.lib.dto.crm.*;
import ru.igorit.monitoring.lib.enums.CrmAgentType;
import ru.igorit.monitoring.lib.persistence.entity.crm.*;

@Mapper(componentModel = "spring")
public interface CrmModelMapper {

    @Mapping(target = "value", expression = "java(crmAgentType.name())")
    @Mapping(target = "name", source = "name")
    @Mapping(target = "description", source = "description")
    CrmAgentTypeDto toDto(CrmAgentType crmAgentType);

    @Mapping(target = "organizationId", source = "organization.id")
    @Mapping(target = "agentType", source = "type")
    CrmAgentListDto toListDto(CrmAgentListProjection item);

    @Mapping(target = "organizationId", source = "organization.id")
    @Mapping(target = "agentType", source = "item", qualifiedByName = "agentTypeToString")
    CrmAgentItemDto toDto(CrmAgent item);

    @Mapping(target = "agentType", source = "item.agent", qualifiedByName = "agentTypeToString")
    @Mapping(target = "agentId", source = "item.agent.id")
    CrmAgentConfigDto toDto(CrmAgentConfig item);

    CrmOrganizationDto toDto(CrmOrganization item);

    CrmServiceDto toDto(CrmService item);


    @Named("agentTypeToString")
    default String agentTypeToString(CrmAgent agent) {
        return agent.getType() != null ? agent.getType().name() : null;
    }
}
