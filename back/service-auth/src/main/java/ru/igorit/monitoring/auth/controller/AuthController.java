package ru.igorit.monitoring.auth.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.igorit.monitoring.auth.dto.*;
import ru.igorit.monitoring.auth.service.AuthService;
import ru.igorit.monitoring.security.service.JwtService;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final AuthService authService;
    private final JwtService jwtService;

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest request,
                                               HttpServletResponse response) {
        log.info("Login attempt for user: {}", request.getUsername());
        TokenResponse tokenResponse  = authService.login(request, response);
        return ResponseEntity.ok(tokenResponse );
    }

    @PostMapping("/register")
    public ResponseEntity<TokenResponse> register(@Valid @RequestBody RegistrationRequest request) {
        log.info("Registration attempt for user: {}", request.getUsername());
        TokenResponse response = authService.register(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        log.info("Change password attempt");
        authService.changePassword(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(@RequestParam String refreshToken) {
        log.info("Refresh token attempt");
        TokenResponse response = authService.refreshToken(refreshToken);
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
    public ResponseEntity<UserResponse> getCurrentUser(HttpServletRequest request) {
        log.info("Get current user");
        UserResponse user = authService.getCurrentUser(request);
        return ResponseEntity.ok(user);
    }

    @GetMapping("/check")
    public ResponseEntity<TokenResponse> checkAuth(HttpServletRequest request) {
        log.info("Check auth via cookie");
        TokenResponse response = authService.checkAuth(request);
        return ResponseEntity.ok(response);
    }
}