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
import ru.igorit.monitoring.persistence.entity.auth.Role;
import ru.igorit.monitoring.persistence.entity.auth.User;
import ru.igorit.monitoring.rabbit.service.CommandSender;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import static ru.igorit.monitoring.security.util.AuthInfoUtils.extractUserId;
import static ru.igorit.monitoring.security.util.AuthInfoUtils.getCurrentAuth;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserManagementService {

    private final AuthManagementPersistService persistService;
    private final UserManagementMapper userManagementMapper;
    private final CommandSender commandSender;
    private final ResetPasswordService resetPasswordService;
    private final UserService userService;


    // ============================================================
    // Публичные методы. Пользователь — Просмотр
    // ============================================================

    @PreAuthorize("hasAuthority('USER_READ')")
    @Transactional(readOnly = true)
    public List<UserListItemDto> getUserList() {
        return persistService.findAllUsers().stream()
                .map(userManagementMapper::toUserListItem)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public UserResponseDto getCurrentUser() {
        return toResponse(getCurrentUserEntity());
    }

    @PreAuthorize("hasAuthority('USER_READ')")
    @Transactional(readOnly = true)
    public UserResponseDto getUserById(String userId) {
        return toResponse(getUserEntityById(userId));
    }

    // ============================================================
    // Публичные методы. Пользователь — Обновление
    // ============================================================

    @Transactional
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
    public UserResponseDto updateUserFull(String userId, UpdateUserRequestDto request) {
        User user = getUserEntityById(userId);
        String updaterId = extractUserId(getCurrentAuth());
        var saved = updateAllFields(user, request, updaterId);
        updatePersonalFields(user, request);
        sendUserUpdatedEvent(saved, true);
        log.info("User fully updated: {}", saved.getUsername());
        return toResponse(saved);
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER','USER_WRITE')")
    @Transactional
    public UserResponseDto addUser(UpdateUserRequestDto request) {
        String creatorId = extractUserId(getCurrentAuth());
        User saved = userService.createLocalUser(request.getUsername(), request.getEmail(),null,
                request.getFirstName(), request.getLastName(), request.getDisplayName(), creatorId);
        return toResponse(saved);
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER','USER_WRITE')")
    @Transactional
    public void resetPasswordToDefault(String userId) {
        User user = getUserEntityById(userId);
        resetPasswordService.setDefaultPassword(user);
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER','USER_WRITE')")
    @Transactional
    public void setPassword(String userId, String newPassword) {
        User user = getUserEntityById(userId);
        resetPasswordService.setPassword(user, newPassword);
    }

    // ============================================================
    // Публичные методы. Роль — Просмотр
    // ============================================================
    @PreAuthorize("hasAnyAuthority('SUPERUSER','USER_WRITE','USER_READ')")
    @Transactional(readOnly = true)
    public List<RoleDto> getAllRoles() {
        return persistService.findAllRoles().stream()
                .map(role -> RoleDto.builder()
                        .name(role.getName())
                        .description(role.getDescription())
                        .build())
                .collect(Collectors.toList());
    }


    @PreAuthorize("hasAnyAuthority('SUPERUSER','USER_WRITE','USER_READ')")
    @Transactional(readOnly = true)
    public List<RoleDto> getUserRoles(String userId) {
        User user = getUserEntityById(userId);
        return user.getRoles().stream()
                .map(userManagementMapper::toRoleDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<RoleDto> getCurrentUserRoles() {
        User user = getCurrentUserEntity();
        return user.getRoles().stream()
                .map(userManagementMapper::toRoleDto)
                .collect(Collectors.toList());
    }

    // ============================================================
    // Публичные методы. Полномочия — Просмотр
    // ============================================================
    @PreAuthorize("hasAnyAuthority('SUPERUSER','USER_WRITE','USER_READ')")
    @Transactional(readOnly = true)
    public List<PermissionDto> getAllPermissions() {
        return persistService.findAllPermissions().stream()
                .map(userManagementMapper::toPermissionDto)
                .collect(Collectors.toList());
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER','USER_WRITE','USER_READ')")
    @Transactional(readOnly = true)
    public List<PermissionDto> getUserPermissions(String userId) {
        User user = getUserEntityById(userId);
        return user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(userManagementMapper::toPermissionDto)
                .distinct().collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PermissionDto> getCurrentUserPermissions() {
        User user = getCurrentUserEntity();
        return user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(userManagementMapper::toPermissionDto)
                .distinct().collect(Collectors.toList());
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
        return persistService.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));
    }

    /**
     * Преобразование User в UserResponse
     */
    private UserResponseDto toResponse(User user) {
        return userManagementMapper.toResponse(user);
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
                user.setRoles(new HashSet<>(persistService.findByNameIn(request.getRoles())));
                user = persistService.findById(user.getId())
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
     * Приватный метод для отправки события
     */
    private void sendUserUpdatedEvent(User user, boolean fullUpdate) {
        try {
            UserInfoUpdatedEventCommandDto event = userManagementMapper.toUserUpdatedEvent(user);
            event.setFullUpdate(fullUpdate);

            commandSender.sendCommand(CommandMessageType.USER_INFO_UPDATED, event);
            log.info("User updated event sent for user: {}", user.getUsername());
        } catch (Exception e) {
            // Не даём упасть приложению, если RabbitMQ недоступен
            log.error("Failed to send user updated event for user: {}", user.getUsername(), e);
        }
    }

}