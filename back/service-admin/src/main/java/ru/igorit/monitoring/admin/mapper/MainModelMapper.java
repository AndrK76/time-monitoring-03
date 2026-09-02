package ru.igorit.monitoring.admin.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;
import ru.igorit.monitoring.admin.dto.OrganizationItemDto;
import ru.igorit.monitoring.admin.dto.OrganizationListDto;
import ru.igorit.monitoring.persistence.entity.admin.AppUser;
import ru.igorit.monitoring.persistence.entity.admin.Organization;
import ru.igorit.monitoring.persistence.entity.admin.UserOrganization;
import ru.igorit.monitoring.web.dto.UserListItemDto;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Mapper(componentModel = "spring")
public interface MainModelMapper {

    OrganizationListDto toListDto(Organization organization);


    @Mapping(target = "createdBy", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedBy", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "users", ignore = true)
    Organization fromListDto(OrganizationListDto dto);

    @Mapping(target = "users", source = "users", qualifiedByName = "serOrganizationsToIdsArray")
    OrganizationItemDto toItemDto(Organization organization);


    @Named("serOrganizationsToIdsArray")
    default String[] userIdsFromUserOrganizations(Set<UserOrganization> userOrganizations) {
        if (userOrganizations == null) return new String[0];
        return userOrganizations.stream()
                .map(uo -> uo.getUser().getId())
                .toList().toArray(new String[0]);
    }

    OrganizationListDto toShortDto(OrganizationItemDto dto);

    @Mapping(target = "users", ignore = true)
    OrganizationItemDto toFullDto(OrganizationListDto organization);

    default Set<String> toUserIds(Organization organization) {
        return organization.getUsers().stream()
                .map(uo -> uo.getUser().getId())
                .collect(Collectors.toSet());
    }

    default Set<String> toUserIds(OrganizationItemDto dto) {
        return dto.getUsers() != null
                ? Arrays.stream(dto.getUsers()).collect(Collectors.toSet())
                : Set.of();
    }

    @Mapping(target = "approved", ignore = true)
    @Mapping(target = "active", source = "valid")
    @Mapping(target = "roles", ignore = true)
    UserListItemDto toListDto(AppUser user);

}
