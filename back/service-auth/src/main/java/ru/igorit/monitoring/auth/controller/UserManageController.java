package ru.igorit.monitoring.auth.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import ru.igorit.monitoring.auth.dto.*;
import ru.igorit.monitoring.auth.helper.AuthErrorHelper;
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
    private final AuthErrorHelper authErrorHelper;

    @GetMapping({"/users", "/users/"})
    public ResponseEntity<List<UserListItemDto>> getUserList() {
        try {
        log.info("Getting users list");
        return ResponseEntity.ok(userManagementService.getUserList());
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @GetMapping("users/me")
    public ResponseEntity<UserResponseDto> getCurrentUser() {
        log.info("Getting current user");
        return ResponseEntity.ok(userManagementService.getCurrentUser());
    }

    @GetMapping("/users/{userId}")
    public UserResponseDto getUserById(@PathVariable String userId) {
            log.info("Getting user by id: {}", userId);
            return userManagementService.getUserById(userId);
    }

    @PostMapping({"/users", "/users/"})
    public ResponseEntity<?> addUser(@Valid @RequestBody UpdateUserRequestDto request) {
        log.info("Adding user: {}", request.getUsername());
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(userManagementService.addUser(request));
        } catch (Exception e) {
            return authErrorHelper.handleLoginError(e, request.getUsername());
        }
    }

    @PutMapping("/users/me")
    public ResponseEntity<UserResponseDto> updateCurrentUser(
            @Valid @RequestBody UpdateUserRequestDto request) {
        log.info("Updating current user");
        return ResponseEntity.ok(userManagementService.updateCurrentUser(request));
    }

    @PutMapping("/users/{userId}")
    public UserResponseDto updateUserFull(@PathVariable String userId,
                                          @Valid @RequestBody UpdateUserRequestDto request) {
        log.info("Updating user full: {}", userId);
        return userManagementService.updateUserFull(userId, request);
    }

    @PutMapping("/users/{userId}/part")
    public UserResponseDto updateUserPart(@PathVariable String userId,
                                          @Valid @RequestBody UpdateUserRequestDto request) {
        log.info("Updating user partial: {}", userId);
        return userManagementService.updateUserPartial(userId, request);
    }

    @GetMapping("/users/me/roles")
    public ResponseEntity<List<RoleResponseDto>> getCurrentUserRoles() {
        log.info("Getting current user roles");
        return ResponseEntity.ok(userManagementService.getCurrentUserRoles());
    }

    @GetMapping("/users/{userId}/roles")
    public ResponseEntity<List<RoleResponseDto>> getUserRoles(@PathVariable String userId) {
        log.info("Getting roles for user: {}", userId);
        return ResponseEntity.ok(userManagementService.getUserRoles(userId));
    }

    @GetMapping("/users/me/permissions")
    public ResponseEntity<List<PermissionResponseDto>> getCurrentUserPermissions() {
        log.info("Getting current user permissions");
        return ResponseEntity.ok(userManagementService.getCurrentUserPermissions());
    }

    @GetMapping("/users/{userId}/permissions")
    public ResponseEntity<List<PermissionResponseDto>> getUserPermissions(@PathVariable String userId) {
        log.info("Getting permissions for user: {}", userId);
        return ResponseEntity.ok(userManagementService.getUserPermissions(userId));
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
            @Valid @RequestBody ResetPasswordRequestDto request) {
        log.info("Setting password for user: {}", userId);
        userManagementService.setPassword(userId, request.getNewPassword());
        return ResponseEntity.ok().build();
    }

    @GetMapping({"/roles", "/roles/"})
    public ResponseEntity<List<RoleResponseDto>> getAllRoles() {
        log.info("Getting all roles");
        return ResponseEntity.ok(userManagementService.getAllRoles());
    }

    @GetMapping("/roles/full")
    public ResponseEntity<List<RoleWithPermissionDto>> getAllRolesWithPermissions() {
        log.info("Getting all roles with permissions");
        return ResponseEntity.ok(userManagementService.getAllRolesWithPermissions());
    }

    @PostMapping({"/roles", "/roles/"})
    public ResponseEntity<?> addRole(@RequestBody UpdateRoleRequestDto request) {
        log.info("Adding role: {}", request.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(userManagementService.addRole(request));
    }

    @PutMapping("/roles/{roleId}")
    public RoleWithPermissionDto updateRole(@PathVariable String roleId,
                                            @Valid @RequestBody UpdateRoleRequestDto request) {
        log.info("Updating role: {}", roleId);
        return userManagementService.updateRole(roleId, request);
    }

    @DeleteMapping("/roles/{roleId}")
    public ResponseEntity<?> deleteRole(@PathVariable String roleId) {
        log.info("Deleting role: {}", roleId);
        userManagementService.deleteRole(roleId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/permissions")
    public ResponseEntity<List<PermissionResponseDto>> getAllPermissions() {
        log.info("Getting all permissions");
        return ResponseEntity.ok(userManagementService.getAllPermissions());
    }


}