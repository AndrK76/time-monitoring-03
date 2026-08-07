package ru.igorit.monitoring.auth.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import ru.igorit.monitoring.auth.dto.UpdateUserRequest;
import ru.igorit.monitoring.auth.dto.UserResponse;
import ru.igorit.monitoring.auth.service.UserManagementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Slf4j
public class UserController {

    private final UserManagementService userManagementService;

    @GetMapping
    public List<UserResponse> getAllUsers() {
        log.info("Getting all users");
        return userManagementService.getAllUsers();
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser() {
        log.info("Getting current user");
        return ResponseEntity.ok(userManagementService.getCurrentUser());
    }

    @GetMapping("/{userId}")
    public UserResponse getUserById(@PathVariable String userId) {
        log.info("Getting user by id: {}", userId);
        return userManagementService.getUserById(userId);
    }

    @PutMapping("/me")
    public ResponseEntity<UserResponse> updateCurrentUser(
            @Valid @RequestBody UpdateUserRequest request) {
        log.info("Updating current user");
        return ResponseEntity.ok(userManagementService.updateCurrentUser(request));
    }

    @PutMapping("/{userId}")
    public UserResponse updateUser(@PathVariable String userId,
                                   @Valid @RequestBody UpdateUserRequest request) {
        log.info("Updating user: {}", userId);
        return userManagementService.updateUser(userId, request);
    }


}