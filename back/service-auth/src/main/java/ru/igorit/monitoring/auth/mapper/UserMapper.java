package ru.igorit.monitoring.auth.mapper;

import ru.igorit.monitoring.auth.dto.UserResponse;
import ru.igorit.monitoring.persistence.entity.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface UserMapper {

    @Mapping(target = "roles", expression = "java(user.getRoles().stream().map(role -> role.getName()).collect(java.util.stream.Collectors.toList()))")
    @Mapping(target = "permissions", expression = "java(user.getRoles().stream().flatMap(role -> role.getPermissions().stream()).map(permission -> permission.getName()).collect(java.util.stream.Collectors.toList()))")
    UserResponse toResponse(User user);

    List<UserResponse> toResponseList(List<User> users);
}