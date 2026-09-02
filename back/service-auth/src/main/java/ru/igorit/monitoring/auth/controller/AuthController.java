package ru.igorit.monitoring.auth.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.igorit.monitoring.auth.dto.*;
import ru.igorit.monitoring.auth.helper.AuthErrorHelper;
import ru.igorit.monitoring.auth.service.AuthService;
import ru.igorit.monitoring.web.dto.UserResponseDto;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final AuthService authService;
    private final AuthErrorHelper authErrorHelper;

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequestDto request,
                                   HttpServletResponse response) {
        log.info("Login attempt for user: {}", request.getUsername());
        try {
            TokenResponseDto tokenResponse = authService.login(request, response);
            return ResponseEntity.ok(tokenResponse);
        } catch (Exception e) {
            return authErrorHelper.handleLoginError(e, request.getUsername());
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegistrationRequestDto request,
                                      HttpServletResponse response) {
        log.info("Registration attempt for user: {}", request.getUsername());
        try {
            TokenResponseDto tokenResponse = authService.register(request, response);
            return ResponseEntity.ok(tokenResponse);
        } catch (Exception e) {
            return authErrorHelper.handleLoginError(e, request.getUsername());
        }
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@Valid @RequestBody ChangePasswordRequestDto request) {
        log.info("Change password attempt");
        try {
            authService.changePassword(request);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return authErrorHelper.handleLoginError(e, "");
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenResponseDto> refresh(@RequestParam String refreshToken) {
        log.info("Refresh token attempt");
        TokenResponseDto response = authService.refreshToken(refreshToken);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            HttpServletRequest request,
            HttpServletResponse response) {
        log.info("Logout attempt from cookie");
        authService.logout(request, response);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/logout/header")
    public ResponseEntity<Void> logout(@RequestHeader("Authorization") String authHeader) {
        log.info("Logout attempt from header");
        authService.logout(authHeader);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponseDto> getCurrentUser(HttpServletRequest request) {
        log.info("Get current user");
        UserResponseDto user = authService.getCurrentUser(request);
        return ResponseEntity.ok(user);
    }

    @GetMapping("/anonymous")
    public ResponseEntity<UserResponseDto> getAnonymous(HttpServletRequest request) {
        log.info("Get anonymous user");
        UserResponseDto user = authService.getCurrentUser(request);
        return ResponseEntity.ok(user);
    }

    @GetMapping("/check")
    public ResponseEntity<TokenResponseDto> checkAuth(HttpServletRequest request) {
        log.info("Check auth via cookie");
        TokenResponseDto response = authService.checkAuth(request);
        return ResponseEntity.ok(response);
    }
}