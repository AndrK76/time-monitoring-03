package ru.igorit.monitoring.auth.service;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import ru.igorit.monitoring.auth.dto.UpdateUserRequest;
import ru.igorit.monitoring.auth.dto.UserResponse;
import ru.igorit.monitoring.auth.mapper.UserMapper;
import ru.igorit.monitoring.persistence.entity.User;
import ru.igorit.monitoring.persistence.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserManagementService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;

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
        log.info("User updated self-info: {}", user.getUsername());
        return toResponse(userRepository.save(user));
    }

    @PreAuthorize("hasAuthority('USER_WRITE')")
    @Transactional
    public UserResponse updateUser(String userId, UpdateUserRequest request) {
        User user = getUserEntityById(userId);
        updateAllFields(user, request);
        log.info("User fully updated: {}", user.getUsername());
        return toResponse(userRepository.save(user));
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
}