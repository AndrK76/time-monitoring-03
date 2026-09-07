package ru.igorit.monitoring.admin.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;
import ru.igorit.monitoring.common.dto.command.auth.OrganizationInfoChangedEventCommandDto;
import ru.igorit.monitoring.common.dto.command.auth.UserCreatedEventCommandDto;
import ru.igorit.monitoring.common.dto.command.auth.UserInfoUpdatedEventCommandDto;
import ru.igorit.monitoring.lib.persistence.entity.common.Organization;
import ru.igorit.monitoring.persistence.entity.admin.AppOrganization;
import ru.igorit.monitoring.persistence.entity.admin.AppUser;
import ru.igorit.monitoring.persistence.entity.admin.UserOrganization;

import java.util.Set;

@Mapper(componentModel = "spring")
public interface EventCommandMapper {
    @Mapping(target = "id", source = "userId")
    @Mapping(target = "valid", ignore = true)
    @Mapping(target = "roles", ignore = true)
    @Mapping(target = "organizations", ignore = true)
    AppUser fromCreateEvent(UserCreatedEventCommandDto cmd);

    @Mapping(target = "id", source = "userId")
    @Mapping(target = "valid", expression = "java(cmd.isActive() && cmd.isApproved())")
    @Mapping(target = "roles", source = "roles", qualifiedByName = "arrToString")
    @Mapping(target = "organizations", ignore = true)
    AppUser fromChangeEvent(UserInfoUpdatedEventCommandDto cmd);

    @Mapping(target = "orgId", source = "id")
    @Mapping(target = "mode", ignore = true)
    @Mapping(target = "users", source = "users", qualifiedByName = "userOrganizationsToIdsArray")
    OrganizationInfoChangedEventCommandDto toOrgChangeEvent(AppOrganization data);

    @Named("userOrganizationsToIdsArray")
    default String[] userIdsFromUserOrganizations(Set<UserOrganization> userOrganizations) {
        if (userOrganizations == null) return new String[0];
        return userOrganizations.stream()
                .map(uo -> uo.getUser().getId())
                .toList().toArray(new String[0]);
    }

    @Named("arrToString")
    default String arrToString(String[] items) {
        if (items == null || items.length == 0) {
            return "";
        }
        return String.join(",", items);
    }

    @Mapping(target = "orgId", source = "id")
    @Mapping(target = "mode", ignore = true)
    @Mapping(target = "users", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "updatedBy", ignore = true)
    OrganizationInfoChangedEventCommandDto toOrgChangeEvent(Organization data);


}
