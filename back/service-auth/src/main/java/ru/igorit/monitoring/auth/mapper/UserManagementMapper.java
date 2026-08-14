package ru.igorit.monitoring.auth.mapper;

import org.mapstruct.Named;
import ru.igorit.monitoring.auth.dto.PermissionDto;
import ru.igorit.monitoring.auth.dto.RoleDto;
import ru.igorit.monitoring.auth.dto.UserListItemDto;
import ru.igorit.monitoring.auth.dto.UserResponseDto;
import ru.igorit.monitoring.common.dto.UserInfoUpdatedEvent;
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
    UserResponseDto toResponse(User user);

    List<UserResponseDto> toResponseList(List<User> users);

    UserListItemDto toUserListItem(User user);

    RoleDto toRoleDto(Role role);

    PermissionDto toPermissionDto(Permission permission);

    @Mapping(target = "approved", source = "isApproved")
    @Mapping(target = "active", source = "isActive")
    @Mapping(target = "userId", source = "id")
    @Mapping(target = "fullUpdate", ignore = true)
    @Mapping(target = "roles", source = "roles", qualifiedByName = "rolesToArray")
    UserInfoUpdatedEvent toUserUpdatedEvent(User user);


    @Named("rolesToArray")
    default String[] rolesToArray(Set<Role> roles) {
        if (roles == null) {
            return new String[0];
        }
        return roles.stream().map(Role::getName).toArray(String[]::new);
    }
}