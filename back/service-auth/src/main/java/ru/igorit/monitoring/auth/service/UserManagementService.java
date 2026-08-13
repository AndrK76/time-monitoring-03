package ru.igorit.monitoring.auth.service;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import ru.igorit.monitoring.auth.dto.*;
import ru.igorit.monitoring.auth.mapper.UserManagementMapper;
import ru.igorit.monitoring.common.dto.UserUpdatedEvent;
import ru.igorit.monitoring.common.enums.CommandType;
import ru.igorit.monitoring.persistence.entity.Role;
import ru.igorit.monitoring.persistence.repository.PermissionRepository;
import ru.igorit.monitoring.persistence.repository.RoleRepository;
import ru.igorit.monitoring.rabbit.service.CommandSender;
import ru.igorit.monitoring.persistence.entity.User;
import ru.igorit.monitoring.persistence.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.igorit.monitoring.security.service.ResetPasswordService;
import ru.igorit.monitoring.security.util.AuthInfoUtils;

import java.time.LocalDateTime;
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

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final UserManagementMapper userManagementMapper;
    private final CommandSender commandSender;
    private final ResetPasswordService resetPasswordService;


    // ============================================================
    // Публичные методы. Пользователь — Просмотр
    // ============================================================

    @PreAuthorize("hasAuthority('USER_READ')")
    @Transactional(readOnly = true)
    public List<UserListItem> getUserList() {
        return userRepository.findAll().stream()
                .map(userManagementMapper::toUserListItem)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser() {
        return toResponse(getCurrentUserEntity());
    }

    @PreAuthorize("hasAuthority('USER_READ')")
    @Transactional(readOnly = true)
    public UserResponse getUserById(String userId) {
        return toResponse(getUserEntityById(userId));
    }

    // ============================================================
    // Публичные методы. Пользователь — Обновление
    // ============================================================

    @Transactional
    public UserResponse updateCurrentUser(UpdateUserRequest request) {
        User user = getCurrentUserEntity();
        updatePersonalFields(user, request);
        User saved = userRepository.save(user);
        sendUserUpdatedEvent(saved, false);
        log.info("User updated self-info: {}", user.getUsername());
        return toResponse(saved);
    }

    @PreAuthorize("hasAuthority('USER_WRITE')")
    @Transactional
    public UserResponse updateUser(String userId, UpdateUserRequest request) {
        User user = getUserEntityById(userId);
        updateAllFields(user, request);

        User saved = userRepository.save(user);
        sendUserUpdatedEvent(saved, true);
        log.info("User fully updated: {}", user.getUsername());
        return toResponse(saved);
    }

    @PreAuthorize("hasAuthority('USER_WRITE')")
    @Transactional
    public void resetPasswordToDefault(String userId) {
        User user = getUserEntityById(userId);
        resetPasswordService.setDefaultPassword(user);
    }

    @PreAuthorize("hasAuthority('USER_WRITE')")
    @Transactional
    public void setPassword(String userId, String newPassword) {
        User user = getUserEntityById(userId);
        resetPasswordService.setPassword(user, newPassword);
    }

    // ============================================================
    // Публичные методы. Роль — Просмотр
    // ============================================================
    @PreAuthorize("hasAuthority('USER_READ')")
    @Transactional(readOnly = true)
    public List<RoleDto> getAllRoles() {
        return roleRepository.findAll().stream()
                .map(role -> RoleDto.builder()
                        .name(role.getName())
                        .description(role.getDescription())
                        .build())
                .collect(Collectors.toList());
    }


    @PreAuthorize("hasAuthority('USER_READ')")
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
    @PreAuthorize("hasAuthority('USER_READ')")
    @Transactional(readOnly = true)
    public List<PermissionDto> getAllPermissions() {
        return permissionRepository.findAll().stream()
                .map(userManagementMapper::toPermissionDto)
                .collect(Collectors.toList());
    }

    @PreAuthorize("hasAuthority('USER_READ')")
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

        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    /**
     * Получение пользователя по ID
     */
    private User getUserEntityById(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));
    }

    /**
     * Преобразование User в UserResponse
     */
    private UserResponse toResponse(User user) {
        return userManagementMapper.toResponse(user);
    }

    /**
     * Обновление полей пользователя из запроса (полный доступ)
     */
    private void updateAllFields(User user, UpdateUserRequest request) {
        var updater = extractUserId(getCurrentAuth());
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setDisplayName(request.getDisplayName());
        Optional.ofNullable(request.getActive()).ifPresent(user::setIsActive);
        Optional.ofNullable(request.getEmailVerified()).ifPresent(user::setIsEmailVerified);
        user.setUpdatedBy(updater);
        if (request.getRoles() != null) {
            List<Role> roles = roleRepository.findByNameIn(request.getRoles());
            user.setRoles(new HashSet<>(roles));
        }
    }

    /**
     * Обновление только личных полей пользователя (без прав)
     */
    private void updatePersonalFields(User user, UpdateUserRequest request) {
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setDisplayName(request.getDisplayName());
        user.setUpdatedBy(user.getId());
    }

    /**
     * Приватный метод для отправки события
     */
    private void sendUserUpdatedEvent(User user, boolean fullUpdate) {
        try {
            UserUpdatedEvent event = UserUpdatedEvent.builder()
                    .userId(user.getId())
                    .username(user.getUsername())
                    .email(user.getEmail())
                    .firstName(user.getFirstName())
                    .lastName(user.getLastName())
                    .displayName(user.getDisplayName())
                    .updatedAt(LocalDateTime.now())
                    .fullUpdate(fullUpdate)
                    .build();

            commandSender.sendCommand(CommandType.USER_UPDATED, event);
            log.info("User updated event sent for user: {}", user.getUsername());
        } catch (Exception e) {
            // Не даём упасть приложению, если RabbitMQ недоступен
            log.error("Failed to send user updated event for user: {}", user.getUsername(), e);
        }
    }

}