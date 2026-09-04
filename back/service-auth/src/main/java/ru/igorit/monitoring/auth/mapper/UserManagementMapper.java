package ru.igorit.monitoring.auth.mapper;

import org.mapstruct.Named;
import ru.igorit.monitoring.auth.dto.*;
import ru.igorit.monitoring.common.dto.command.auth.UserCreatedEventCommandDto;
import ru.igorit.monitoring.common.dto.command.auth.UserInfoUpdatedEventCommandDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import ru.igorit.monitoring.persistence.entity.auth.AuthOrganization;
import ru.igorit.monitoring.persistence.entity.auth.Permission;
import ru.igorit.monitoring.persistence.entity.auth.Role;
import ru.igorit.monitoring.persistence.entity.auth.User;
import ru.igorit.monitoring.web.dto.OrganizationListDto;
import ru.igorit.monitoring.web.dto.UserListItemDto;
import ru.igorit.monitoring.web.dto.UserResponseDto;

import java.util.List;
import java.util.Set;

@Mapper(componentModel = "spring")
public interface UserManagementMapper {

    @Mapping(target = "superUser", ignore = true)
    @Mapping(target = "approved", source = "isApproved")
    @Mapping(target = "emailVerified", source = "isEmailVerified")
    @Mapping(target = "active", source = "isActive")
    @Mapping(target = "roles", expression = "java(user.getRoles().stream().map(Role::getName).collect(java.util.stream.Collectors.toList()))")
    @Mapping(target = "permissions", expression = "java(user.getRoles().stream().flatMap(role -> role.getPermissions().stream()).map(ru.igorit.monitoring.persistence.entity.auth.Permission::getName).collect(java.util.stream.Collectors.toList()))")
    @Mapping(target = "organizations", expression = "java(user.getOrgIds().stream().collect(java.util.stream.Collectors.toList()))")
    UserResponseDto toResponseDto(User user);

    List<UserResponseDto> toResponseList(List<User> users);

    @Mapping(target = "active", source = "isActive")
    @Mapping(target = "approved", source = "isApproved")
    @Mapping(target = "roles", expression = "java(user.getRoles().stream().map(Role::getName).collect(java.util.stream.Collectors.toList()))")
    @Mapping(target = "organizations", expression = "java(user.getOrgIds().stream().collect(java.util.stream.Collectors.toList()))")
    UserListItemDto toListDto(User user);


    UserListItemDto toListDto(UserResponseDto dtoFull);




    @Mapping(target = "approved", source = "isApproved")
    @Mapping(target = "active", source = "isActive")
    @Mapping(target = "userId", source = "id")
    @Mapping(target = "fullUpdate", ignore = true)
    @Mapping(target = "roles", source = "roles", qualifiedByName = "rolesToArray")
    UserInfoUpdatedEventCommandDto toUserUpdatedEvent(User user);

    @Mapping(target = "userId", source = "id")
    @Mapping(target = "active", source = "isActive")
    UserCreatedEventCommandDto toUserCreatedEvent(User user);

    @Mapping(target = "special", source = "permissions", qualifiedByName = "containsSpecialPermission")
    RoleResponseDto toResponseDto(Role role);


    @Mapping(target = "permissions", source = "permissions", qualifiedByName = "permissionsToArray")
    @Mapping(target = "special", source = "permissions", qualifiedByName = "containsSpecialPermission")
    RoleWithPermissionDto toRoleWithPermissionDto(Role role);

    PermissionResponseDto toResponseDto(Permission permission);

    OrganizationListDto toListDto(AuthOrganization org);


    @Named("rolesToArray")
    default String[] rolesToArray(Set<Role> roles) {
        if (roles == null) {
            return new String[0];
        }
        return roles.stream().map(Role::getName).toArray(String[]::new);
    }

    @Named("permissionsToArray")
    default String[] permissionsToArray(Set<Permission> permissions) {
        if (permissions == null) {
            return new String[0];
        }
        return permissions.stream().map(Permission::getName).toArray(String[]::new);
    }

    @Named("containsSpecialPermission")
    default boolean containsSpecialPermission(Set<Permission> permissions) {
        return permissions != null && permissions.stream().anyMatch(Permission::isSpecial);
    }
}