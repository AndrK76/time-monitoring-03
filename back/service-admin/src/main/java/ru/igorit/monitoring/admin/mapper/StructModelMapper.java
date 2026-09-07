package ru.igorit.monitoring.admin.mapper;

import org.mapstruct.Mapper;
import ru.igorit.monitoring.lib.dto.OrgStructListDto;
import ru.igorit.monitoring.lib.persistence.entity.common.Organization;

@Mapper(componentModel = "spring")
public interface StructModelMapper {

    OrgStructListDto toListDto(Organization organization);

}
