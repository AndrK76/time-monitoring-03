package ru.igorit.monitoring.auth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.igorit.monitoring.auth.dto.*;
import ru.igorit.monitoring.auth.mapper.UserManagementMapper;
import ru.igorit.monitoring.common.dto.command.auth.UserInfoUpdatedEventCommandDto;
import ru.igorit.monitoring.common.enums.command.CommandMessageType;
import ru.igorit.monitoring.persistence.entity.auth.Permission;
import ru.igorit.monitoring.persistence.entity.auth.Role;
import ru.igorit.monitoring.persistence.entity.auth.User;
import ru.igorit.monitoring.rabbit.service.CommandSender;
import ru.igorit.monitoring.web.dto.OrganizationListDto;
import ru.igorit.monitoring.web.dto.UserListItemDto;
import ru.igorit.monitoring.web.dto.UserResponseDto;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import static ru.igorit.monitoring.security.util.AuthInfoUtils.extractUserId;
import static ru.igorit.monitoring.security.util.AuthInfoUtils.getCurrentAuth;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserManagementServiceImpl implements UserManagementService {

    private final AuthManagementPersistService persistService;
    private final UserManagementMapper userManagementMapper;
    private final CommandSender commandSender;
    private final ResetPasswordService resetPasswordService;
    private final UserService userService;


    // ============================================================
    // Публичные методы. Пользователь
    // ============================================================

    @PreAuthorize("hasAnyAuthority('SUPERUSER', 'USER_WRITE', 'USER_READ')")
    @Transactional(readOnly = true)
    @Override
    public List<UserListItemDto> getUserList() {
        return persistService.findAllUsers().stream()
                .map(userManagementMapper::toListDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    @Override
    public UserResponseDto getCurrentUser() {
        return toResponse(getCurrentUserEntity());
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER', 'USER_WRITE', 'USER_READ')")
    @Transactional(readOnly = true)
    @Override
    public UserResponseDto getUserById(String userId) {
        return toResponse(getUserEntityById(userId));
    }

    // ============================================================
    // Публичные методы. Пользователь
    // ============================================================

    @Transactional
    @Override
    public UserResponseDto updateCurrentUser(UpdateUserRequestDto request) {
        User user = getCurrentUserEntity();
        updatePersonalFields(user, request);
        User saved = persistService.saveUser(user);
        sendUserUpdatedEvent(saved, false);
        log.info("User updated self-info: {}", user.getUsername());
        return toResponse(saved);
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER', 'USER_WRITE', 'USER_READ')")
    @Transactional
    @Override
    public UserResponseDto updateUserPartial(String userId, UpdateUserRequestDto request) {
        User user = getUserEntityById(userId);
        String updaterId = extractUserId(getCurrentAuth());
        updatePersonalFields(user, request, updaterId);
        User saved = persistService.saveUser(user);
        sendUserUpdatedEvent(saved, false);
        log.info("User part updated: {}", user.getUsername());
        return toResponse(saved);
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER', 'USER_WRITE')")
    @Transactional
    @Override
    public UserResponseDto updateUserFull(String userId, UpdateUserRequestDto request) {
        User user = getUserEntityById(userId);
        String updaterId = extractUserId(getCurrentAuth());
        var saved = updateAllFields(user, request, updaterId);
        sendUserUpdatedEvent(saved, true);
        log.info("User fully updated: {}", saved.getUsername());
        return toResponse(saved);
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER','USER_WRITE')")
    @Transactional
    @Override
    public UserResponseDto addUser(UpdateUserRequestDto request) {
        String creatorId = extractUserId(getCurrentAuth());
        User saved = userService.createLocalUser(request.getUsername(), request.getEmail(), null,
                request.getFirstName(), request.getLastName(), request.getDisplayName(), creatorId);
        return toResponse(saved);
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER','USER_WRITE')")
    @Transactional
    @Override
    public void resetPasswordToDefault(String userId) {
        User user = getUserEntityById(userId);
        resetPasswordService.setDefaultPassword(user);
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER','USER_WRITE')")
    @Transactional
    @Override
    public void setPassword(String userId, String newPassword) {
        User user = getUserEntityById(userId);
        resetPasswordService.setPassword(user, newPassword);
    }

    // ============================================================
    // Публичные методы. Роль
    // ============================================================
    @PreAuthorize("hasAnyAuthority('SUPERUSER','USER_WRITE','USER_READ')")
    @Transactional(readOnly = true)
    @Override
    public List<RoleResponseDto> getAllRoles() {
        return persistService.findAllRoles().stream()
                .map(userManagementMapper::toResponseDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    @Override
    public List<RoleWithPermissionDto> getAllRolesWithPermissions() {
        return persistService.findAllRoles().stream()
                .map(userManagementMapper::toRoleWithPermissionDto)
                .collect(Collectors.toList());
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER','USER_WRITE','USER_READ')")
    @Transactional(readOnly = true)
    @Override
    public List<RoleResponseDto> getUserRoles(String userId) {
        User user = getUserEntityById(userId);
        return user.getRoles().stream()
                .map(userManagementMapper::toResponseDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    @Override
    public List<RoleResponseDto> getCurrentUserRoles() {
        User user = getCurrentUserEntity();
        return user.getRoles().stream()
                .map(userManagementMapper::toResponseDto)
                .collect(Collectors.toList());
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER')")
    @Transactional
    @Override
    public RoleWithPermissionDto updateRole(String roleId, UpdateRoleRequestDto request) {
        Role role = getRoleEntityById(roleId);
        String updaterId = extractUserId(getCurrentAuth());
        var saved = updateAllFields(role, request, updaterId);
        //sendUserUpdatedEvent(saved, true);
        log.info("Role fully updated: {}", saved.getName());
        return userManagementMapper.toRoleWithPermissionDto(saved);
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER')")
    @Transactional
    @Override
    public RoleWithPermissionDto addRole(UpdateRoleRequestDto request) {
        String creatorId = extractUserId(getCurrentAuth());
        Role saved = persistService.saveRole(
                Role.newRole(request.getName(), request.getDescription(), creatorId));
        return userManagementMapper.toRoleWithPermissionDto(saved);
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER')")
    @Transactional
    @Override
    public void deleteRole(String roleId) {
        persistService.findRoleById(roleId).ifPresent(persistService::deleteRole);
    }

    // ============================================================
    // Публичные методы. Полномочия — Просмотр
    // ============================================================
    @PreAuthorize("hasAnyAuthority('SUPERUSER','USER_WRITE','USER_READ')")
    @Transactional(readOnly = true)
    @Override
    public List<PermissionResponseDto> getAllPermissions() {
        return persistService.findAllPermissions().stream()
                .map(userManagementMapper::toResponseDto)
                .collect(Collectors.toList());
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER','USER_WRITE','USER_READ')")
    @Transactional(readOnly = true)
    @Override
    public List<PermissionResponseDto> getUserPermissions(String userId) {
        User user = getUserEntityById(userId);
        return user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(userManagementMapper::toResponseDto)
                .distinct().collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    @Override
    public List<PermissionResponseDto> getCurrentUserPermissions() {
        User user = getCurrentUserEntity();
        return user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(userManagementMapper::toResponseDto)
                .distinct().collect(Collectors.toList());
    }


    // ============================================================
    // Публичные методы. Организации — Просмотр
    // ============================================================
    @PreAuthorize("hasAnyAuthority('SUPERUSER','USER_WRITE','USER_READ')")
    @Transactional(readOnly = true)
    @Override
    public List<OrganizationListDto> getAllOrganizations() {
        return persistService.findAllOrganizations().stream()
                .map(userManagementMapper::toListDto)
                .collect(Collectors.toList());
    }


    /**
     * Получение текущего пользователя из SecurityContext
     */
    private User getCurrentUserEntity() {
        Authentication auth = getCurrentAuth();
        if (auth == null || !auth.isAuthenticated()) {
            throw new RuntimeException("Not authenticated");
        }

        return persistService.findByUsername(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    /**
     * Получение пользователя по ID
     */
    private User getUserEntityById(String userId) {
        return persistService.findUserById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));
    }

    /**
     * Преобразование User в UserResponse
     */
    private UserResponseDto toResponse(User user) {
        return userManagementMapper.toResponseDto(user);
    }

    /**
     * Обновление полей пользователя из запроса (полный доступ)
     */
    private User updateAllFields(User user, UpdateUserRequestDto request, String updaterId) {
        var updater = extractUserId(getCurrentAuth());
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setDisplayName(request.getDisplayName());
        Optional.ofNullable(request.getActive()).ifPresent(user::setIsActive);
        Optional.ofNullable(request.getEmailVerified()).ifPresent(user::setIsEmailVerified);
        log.debug("Before: isApproved={}, request.getUserApproved={}", user.getIsApproved(), request.getUserApproved());
        if (request.getUserApproved() != null && request.getUserApproved() &&
                (user.getIsApproved() == null || !user.getIsApproved())) {
            user.setIsApproved(true);
        }
        user.setUpdatedBy(updater);
        log.debug("after: isApproved={}, request.getUserApproved={}", user.getIsApproved(), request.getUserApproved());
        user = persistService.saveUser(user);
        log.debug("after save: isApproved={}, request.getUserApproved={}", user.getIsApproved(), request.getUserApproved());
        if (request.getRoles() != null) {
            var currRoles = user.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
            var newRoles = new HashSet<>(request.getRoles());
            if (!currRoles.equals(newRoles)) {
                //List<Role> roles = persistService.findByNameIn(request.getRoles());
                persistService.updateUserRoles(user, request.getRoles(), updaterId);
                user.setRoles(new HashSet<>(persistService.findRoleByNameIn(request.getRoles())));
                user = persistService.findUserById(user.getId())
                        .orElseThrow(() -> new RuntimeException("User not found"));
            }
        }
        log.debug("result method: isApproved={}", user.getIsApproved());
        return user;
    }

    /**
     * Обновление только личных полей пользователя (чужого)
     */
    private void updatePersonalFields(User user, UpdateUserRequestDto request, String updaterId) {
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setDisplayName(request.getDisplayName());
        user.setEmail((request.getEmail()));
        user.setUpdatedBy(updaterId);
    }

    /**
     * Обновление только личных полей пользователя (без прав)
     */
    private void updatePersonalFields(User user, UpdateUserRequestDto request) {
        updatePersonalFields(user, request, user.getId());
    }

    /**
     * Получение пользователя по ID
     */
    private Role getRoleEntityById(String roleId) {
        return persistService.findRoleById(roleId)
                .orElseThrow(() -> new RuntimeException("Role not found: " + roleId));
    }

    /**
     * Обновление полей роли из запроса (полный доступ)
     */
    private Role updateAllFields(Role role, UpdateRoleRequestDto request, String updaterId) {
        var updater = extractUserId(getCurrentAuth());
        role.setName(request.getName());
        role.setDescription(request.getDescription());
        role.setUpdatedBy(updater);
        role = persistService.saveRole(role);
        if (request.getPermissions() != null) {
            var currPermissions = role.getPermissions().stream().map(Permission::getName).collect(Collectors.toSet());
            var newPermissions = new HashSet<>(request.getPermissions());
            if (!currPermissions.equals(newPermissions)) {
                //List<Role> roles = persistService.findByNameIn(request.getRoles());
                persistService.updateRolePermissions(role, request.getPermissions(), updaterId);
                role.setPermissions(new HashSet<>(persistService.findPermissionByNameIn(request.getPermissions())));
                role = persistService.findRoleById(role.getId())
                        .orElseThrow(() -> new RuntimeException("Role not found"));

            }
        }
        return role;
    }

    /**
     * Приватный метод для отправки события
     */
    private void sendUserUpdatedEvent(User user, boolean fullUpdate) {
        try {
            UserInfoUpdatedEventCommandDto event = userManagementMapper.toUserUpdatedEvent(user);
            event.setFullUpdate(fullUpdate);

            commandSender.sendCommandToInternal(commandSender.getConfig().getAppServerRoute(),
                    CommandMessageType.USER_INFO_UPDATED, event);
            log.info("User updated event sent for user: {}", user.getUsername());
        } catch (Exception e) {
            // Не даём упасть приложению, если RabbitMQ недоступен
            log.error("Failed to send user updated event for user: {}", user.getUsername(), e);
        }
    }

}