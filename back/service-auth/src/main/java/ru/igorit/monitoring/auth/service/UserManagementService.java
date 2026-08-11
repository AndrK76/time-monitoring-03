package ru.igorit.monitoring.auth.service;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import ru.igorit.monitoring.auth.dto.UpdateUserRequest;
import ru.igorit.monitoring.auth.dto.UserResponse;
import ru.igorit.monitoring.auth.mapper.UserMapper;
import ru.igorit.monitoring.common.dto.UserUpdatedEvent;
import ru.igorit.monitoring.rabbit.service.CommandSender;
import ru.igorit.monitoring.persistence.entity.User;
import ru.igorit.monitoring.persistence.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserManagementService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final CommandSender commandSender;

    // ============================================================
    // Публичные методы — Просмотр
    // ============================================================

    @PreAuthorize("hasAuthority('USER_READ')")
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(userMapper::toResponse)
                .collect(Collectors.toList());
    }

    public UserResponse getCurrentUser() {
        return toResponse(getCurrentUserEntity());
    }

    @PreAuthorize("hasAuthority('USER_READ')")
    public UserResponse getUserById(String userId) {
        return toResponse(getUserEntityById(userId));
    }

    // ============================================================
    // Публичные методы — Обновление
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

    /**
     * Получение текущего пользователя из SecurityContext
     */
    private User getCurrentUserEntity() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
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
        return userMapper.toResponse(user);
    }

    /**
     * Обновление полей пользователя из запроса (полный доступ)
     */
    private void updateAllFields(User user, UpdateUserRequest request) {
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setDisplayName(request.getDisplayName());
    }

    /**
     * Обновление только личных полей пользователя (без прав)
     */
    private void updatePersonalFields(User user, UpdateUserRequest request) {
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setDisplayName(request.getDisplayName());
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
                    .updatedBy(getCurrentUsername())
                    .fullUpdate(fullUpdate)
                    .build();

            commandSender.sendUserUpdatedEvent(event);
            log.info("User updated event sent for user: {}", user.getUsername());
        } catch (Exception e) {
            // Не даём упасть приложению, если RabbitMQ недоступен
            log.error("Failed to send user updated event for user: {}", user.getUsername(), e);
        }
    }

    private String getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : "system";
    }
}