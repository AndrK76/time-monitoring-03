package ru.igorit.monitoring.auth.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import ru.igorit.monitoring.auth.dto.*;
import ru.igorit.monitoring.auth.service.UserManagementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/usermanage")
@RequiredArgsConstructor
@Slf4j
public class UserManageController {

    private final UserManagementService userManagementService;

    @GetMapping("/users")
    public ResponseEntity<List<UserListItem>> getUserList() {
        log.info("Getting users list");
        return ResponseEntity.ok(userManagementService.getUserList());
    }

    @GetMapping("users/me")
    public ResponseEntity<UserResponse> getCurrentUser() {
        log.info("Getting current user");
        return ResponseEntity.ok(userManagementService.getCurrentUser());
    }

    @GetMapping("/users/{userId}")
    public UserResponse getUserById(@PathVariable String userId) {
        log.info("Getting user by id: {}", userId);
        return userManagementService.getUserById(userId);
    }

    @PutMapping("/users/me")
    public ResponseEntity<UserResponse> updateCurrentUser(
            @Valid @RequestBody UpdateUserRequest request) {
        log.info("Updating current user");
        return ResponseEntity.ok(userManagementService.updateCurrentUser(request));
    }

    @PutMapping("/users/{userId}")
    public UserResponse updateUser(@PathVariable String userId,
                                   @Valid @RequestBody UpdateUserRequest request) {
        log.info("Updating user: {}", userId);
        return userManagementService.updateUser(userId, request);
    }

    @GetMapping("/users/me/roles")
    public ResponseEntity<List<RoleDto>> getCurrentUserRoles() {
        log.info("Getting current user roles");
        return ResponseEntity.ok(userManagementService.getCurrentUserRoles());
    }

    @GetMapping("/users/{userId}/roles")
    public ResponseEntity<List<RoleDto>> getUserRoles(@PathVariable String userId) {
        log.info("Getting roles for user: {}", userId);
        return ResponseEntity.ok(userManagementService.getUserRoles(userId));
    }

    @GetMapping("/roles")
    public ResponseEntity<List<RoleDto>> getAllRoles() {
        log.info("Getting all roles");
        return ResponseEntity.ok(userManagementService.getAllRoles());
    }

    @GetMapping("/users/me/permissions")
    public ResponseEntity<List<PermissionDto>> getCurrentUserPermissions() {
        log.info("Getting current user permissions");
        return ResponseEntity.ok(userManagementService.getCurrentUserPermissions());
    }

    @GetMapping("/users/{userId}/permissions")
    public ResponseEntity<List<PermissionDto>> getUserPermissions(@PathVariable String userId) {
        log.info("Getting permissions for user: {}", userId);
        return ResponseEntity.ok(userManagementService.getUserPermissions(userId));
    }

    @GetMapping("/permissions")
    public ResponseEntity<List<PermissionDto>> getAllPermissions() {
        log.info("Getting all permissions");
        return ResponseEntity.ok(userManagementService.getAllPermissions());
    }

    @PutMapping("/users/{userId}/reset-password")
    public ResponseEntity<Void> resetPassword(@PathVariable String userId) {
        log.info("Resetting password to default for user: {}", userId);
        userManagementService.resetPasswordToDefault(userId);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/users/{userId}/set-password")
    public ResponseEntity<Void> setPassword(
            @PathVariable String userId,
            @Valid @RequestBody ResetPasswordRequest request) {
        log.info("Setting password for user: {}", userId);
        userManagementService.setPassword(userId, request.getNewPassword());
        return ResponseEntity.ok().build();
    }


}