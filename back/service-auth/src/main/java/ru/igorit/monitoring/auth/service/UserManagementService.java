package ru.igorit.monitoring.auth.service;

import ru.igorit.monitoring.auth.dto.*;
import ru.igorit.monitoring.web.dto.UserListItemDto;
import ru.igorit.monitoring.web.dto.UserResponseDto;

import java.util.List;

public interface UserManagementService {

    // ============================================================
    // Публичные методы. Пользователь
    // ============================================================
    List<UserListItemDto> getUserList();

    UserResponseDto getCurrentUser();

    UserResponseDto getUserById(String userId);

    UserResponseDto updateCurrentUser(UpdateUserRequestDto request);

    UserResponseDto updateUserPartial(String userId, UpdateUserRequestDto request);

    UserResponseDto updateUserFull(String userId, UpdateUserRequestDto request);

    UserResponseDto addUser(UpdateUserRequestDto request);

    void resetPasswordToDefault(String userId);

    void setPassword(String userId, String newPassword);

    // ============================================================
    // Публичные методы. Роль
    // ============================================================
    List<RoleResponseDto> getAllRoles();

    List<RoleWithPermissionDto> getAllRolesWithPermissions();

    List<RoleResponseDto> getUserRoles(String userId);

    List<RoleResponseDto> getCurrentUserRoles();

    RoleWithPermissionDto updateRole(String roleId, UpdateRoleRequestDto request);

    RoleWithPermissionDto addRole(UpdateRoleRequestDto request);

    void deleteRole(String roleId);

    // ============================================================
    // Публичные методы. Полномочия
    // ============================================================
    List<PermissionResponseDto> getAllPermissions();

    List<PermissionResponseDto> getUserPermissions(String userId);

    List<PermissionResponseDto> getCurrentUserPermissions();
}
