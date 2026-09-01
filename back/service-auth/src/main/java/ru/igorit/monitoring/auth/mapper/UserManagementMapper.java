package ru.igorit.monitoring.auth.mapper;

import org.mapstruct.Named;
import ru.igorit.monitoring.auth.dto.*;
import ru.igorit.monitoring.common.dto.command.auth.UserCreatedEventCommandDto;
import ru.igorit.monitoring.common.dto.command.auth.UserInfoUpdatedEventCommandDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import ru.igorit.monitoring.persistence.entity.auth.Permission;
import ru.igorit.monitoring.persistence.entity.auth.Role;
import ru.igorit.monitoring.persistence.entity.auth.User;

import java.util.List;
import java.util.Set;

@Mapper(componentModel = "spring")
public interface UserManagementMapper {

    @Mapping(target = "approved", source = "isApproved")
    @Mapping(target = "emailVerified", source = "isEmailVerified")
    @Mapping(target = "active", source = "isActive")
    @Mapping(target = "roles", expression = "java(user.getRoles().stream().map(Role::getName).collect(java.util.stream.Collectors.toList()))")
    @Mapping(target = "permissions", expression = "java(user.getRoles().stream().flatMap(role -> role.getPermissions().stream()).map(ru.igorit.monitoring.persistence.entity.auth.Permission::getName).collect(java.util.stream.Collectors.toList()))")
    UserResponseDto toResponseDto(User user);

    List<UserResponseDto> toResponseList(List<User> users);

    @Mapping(target = "active", source = "isActive")
    @Mapping(target = "approved", source = "isApproved")
    @Mapping(target = "roles", expression = "java(user.getRoles().stream().map(Role::getName).collect(java.util.stream.Collectors.toList()))")
    UserListItemDto toListDto(User user);


    @Mapping(target = "approved", source = "isApproved")
    @Mapping(target = "active", source = "isActive")
    @Mapping(target = "userId", source = "id")
    @Mapping(target = "fullUpdate", ignore = true)
    @Mapping(target = "roles", source = "roles", qualifiedByName = "rolesToArray")
    UserInfoUpdatedEventCommandDto toUserUpdatedEvent(User user);

    @Mapping(target = "userId", source = "id")
    @Mapping(target = "active", source = "isActive")
    UserCreatedEventCommandDto toUserCreatedEvent(User user);

    RoleResponseDto toResponseDto(Role role);


    @Mapping(target = "permissions", source = "permissions", qualifiedByName = "permissionsToArray")
    RoleWithPermissionDto toRoleWithPermissionDto(Role role);

    PermissionResponseDto toResponseDto(Permission permission);



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
}