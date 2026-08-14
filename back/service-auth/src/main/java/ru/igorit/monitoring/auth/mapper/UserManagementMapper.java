package ru.igorit.monitoring.auth.mapper;

import ru.igorit.monitoring.auth.dto.PermissionDto;
import ru.igorit.monitoring.auth.dto.RoleDto;
import ru.igorit.monitoring.auth.dto.UserListItem;
import ru.igorit.monitoring.auth.dto.UserResponse;
import ru.igorit.monitoring.common.dto.UserInfoUpdatedEvent;
import ru.igorit.monitoring.persistence.entity.Permission;
import ru.igorit.monitoring.persistence.entity.Role;
import ru.igorit.monitoring.persistence.entity.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface UserManagementMapper {

    @Mapping(target = "approved", source = "isApproved")
    @Mapping(target = "emailVerified", source = "isEmailVerified")
    @Mapping(target = "active", source = "isActive")
    @Mapping(target = "roles", expression = "java(user.getRoles().stream().map(Role::getName).collect(java.util.stream.Collectors.toList()))")
    @Mapping(target = "permissions", expression = "java(user.getRoles().stream().flatMap(role -> role.getPermissions().stream()).map(ru.igorit.monitoring.persistence.entity.Permission::getName).collect(java.util.stream.Collectors.toList()))")
    UserResponse toResponse(User user);

    List<UserResponse> toResponseList(List<User> users);

    UserListItem toUserListItem(User user);

    RoleDto toRoleDto(Role role);

    PermissionDto toPermissionDto(Permission permission);

    @Mapping(target = "userId", source = "id")
    @Mapping(target = "fullUpdate", ignore = true)
    UserInfoUpdatedEvent toUserUpdatedEvent(User user);
}