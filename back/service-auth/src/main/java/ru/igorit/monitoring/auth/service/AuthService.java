package ru.igorit.monitoring.auth.service;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import ru.igorit.monitoring.auth.dto.*;
import ru.igorit.monitoring.auth.mapper.UserManagementMapper;
import ru.igorit.monitoring.security.service.CookieService;
import ru.igorit.monitoring.auth.service.secur.JwtCreateService;
import ru.igorit.monitoring.common.enums.command.CommandMessageType;
import ru.igorit.monitoring.persistence.entity.auth.Permission;
import ru.igorit.monitoring.persistence.entity.auth.Role;
import ru.igorit.monitoring.persistence.entity.auth.User;
import ru.igorit.monitoring.rabbit.service.CommandSender;
import ru.igorit.monitoring.security.config.CookieProperties;
import ru.igorit.monitoring.security.service.JwtService;
import ru.igorit.monitoring.web.dto.UserResponseDto;

import java.util.List;
import java.util.stream.Collectors;

import static ru.igorit.monitoring.common.AuthConstants.ANONYMOUS_USER;
import static ru.igorit.monitoring.security.util.AuthInfoUtils.extractUserId;
import static ru.igorit.monitoring.security.util.AuthInfoUtils.getCurrentAuth;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserService userService;
    private final JwtService jwtService;
    private final JwtCreateService jwtCreateService;
    private final CookieService cookieService;
    private final PasswordEncoder passwordEncoder;
    private final UserManagementMapper userManagementMapper;
    private final CookieProperties cookieProperties;
    private final AuthManagementPersistService persistService;
    private final CommandSender commandSender;

    // ============================================================
    // ПУБЛИЧНЫЕ МЕТОДЫ
    // ============================================================

    @Transactional
    public TokenResponseDto login(LoginRequestDto request, HttpServletResponse response) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );
        SecurityContextHolder.getContext().setAuthentication(authentication);

        User user = getUserByUsername(request.getUsername());
        TokenResponseDto tokenResponse = buildTokenResponse(user);

        cookieService.addAuthCookie(response, tokenResponse.getAccessToken());
        return tokenResponse;
    }

    @Transactional
    public TokenResponseDto register(RegistrationRequestDto request, HttpServletResponse response) {
        User user = userService.createLocalUser(
                request.getUsername(),
                request.getEmail(),
                request.getPassword(),
                request.getFirstName(),
                request.getLastName(),
                request.getDisplayName(),
                extractUserId(getCurrentAuth()));
        TokenResponseDto tokenResponse = buildTokenResponse(user);
        cookieService.addAuthCookie(response, tokenResponse.getAccessToken());
        sendUserCreateEvent(user);
        return tokenResponse;
    }

    @Transactional
    public void changePassword(ChangePasswordRequestDto request) {
        User user = getCurrentUserEntity();
        validatePasswordChange(request, user);
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setUpdatedBy(extractUserId(getCurrentAuth()));
        persistService.saveUser(user);
        log.info("Password changed for user: {}", user.getUsername());
    }

    @Transactional
    public TokenResponseDto refreshToken(String refreshToken) {
        if (!jwtCreateService.validateRefreshToken(refreshToken)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired refresh token");
        }

        String userId = jwtService.extractUserId(refreshToken);
        User user = getUserById(userId);
        return buildTokenResponse(user);

    }

    public void logout(HttpServletRequest request, HttpServletResponse response) {
        String token = extractTokenFromCookie(request);
        if (token != null) {
            jwtService.invalidateToken(token);
            log.info("Token invalidated");
        }
        cookieService.removeAuthCookie(request, response);
        SecurityContextHolder.clearContext();
        log.info("User logged out");
    }

    public void logout(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            jwtService.invalidateToken(token);
            log.info("Token invalidated from header");
        }
        SecurityContextHolder.clearContext();
    }

    @Transactional
    public UserResponseDto getCurrentUser(HttpServletRequest request) {
        String username = extractUsernameFromContextOrCookie(request);
        User user = getUserByUsernameOrAnonymous(username);
        return userManagementMapper.toResponseDto(user);
    }

    @Transactional
    public TokenResponseDto checkAuth(HttpServletRequest request) {
        String token = extractTokenFromCookie(request);
        if (token == null || !jwtService.isTokenValid(token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired token");
        }

        String username = jwtService.extractUsername(token);
        User user = getUserByUsername(username);

        return buildTokenResponse(user);

    }

    // ============================================================
    // МЕТОДЫ ДЛЯ OAuth2 (заглушки)
    // ============================================================

    public TokenResponseDto handleOAuth2Callback(String provider, String code) {
        log.info("OAuth2 callback from provider: {}, code: {}", provider, code);
        throw new UnsupportedOperationException("OAuth2 authentication not yet implemented. Provider: " + provider);
    }

    public String getOAuth2AuthorizationUrl(String provider) {
        log.info("Getting OAuth2 authorization URL for provider: {}", provider);
        return "/oauth2/authorization/" + provider;
    }

    // ============================================================
    // ПРИВАТНЫЕ МЕТОДЫ — ПОЛУЧЕНИЕ ПОЛЬЗОВАТЕЛЕЙ
    // ============================================================

    private User getCurrentUserEntity() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new RuntimeException("User not authenticated");
        }
        return getUserByUsername(auth.getName());
    }

    private User getUserByUsername(String username) {
        return persistService.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));
    }

    private User getUserById(String userId) {
        return persistService.findUserById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));
    }

    private User getUserByUsernameOrAnonymous(String username) {
        if (username == null || ANONYMOUS_USER.equals(username)) {
            return User.anonymous();
        }
        return getUserByUsername(username);
    }

    private String extractUsernameFromContextOrCookie(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        // Проверяем SecurityContext
        if (auth != null && auth.isAuthenticated() && !ANONYMOUS_USER.equals(auth.getPrincipal())) {
            return auth.getName();
        }

        // Проверяем cookie
        String token = extractTokenFromCookie(request);
        if (token != null && jwtService.isTokenValid(token)) {
            return jwtService.extractUsername(token);
        }

        return null;
    }

    // ============================================================
    // ПРИВАТНЫЕ МЕТОДЫ — ИЗВЛЕЧЕНИЕ ДАННЫХ
    // ============================================================

    private List<String> extractRoles(User user) {
        return user.getRoles().stream()
                .map(Role::getName)
                .collect(Collectors.toList());
    }

    private List<String> extractPermissions(User user) {
        return user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(Permission::getName)
                .collect(Collectors.toList());
    }

    private List<String> extractOrganizations(User user) {
        // TODO: Получать организации пользователя из БД
        return List.of();
    }

    // ============================================================
    // ПРИВАТНЫЕ МЕТОДЫ — ПОСТРОЕНИЕ ОТВЕТОВ
    // ============================================================

    private TokenResponseDto buildTokenResponse(User user) {
        String accessToken = jwtCreateService.generateToken(
                user.getId(),
                user.getUsername(),
                extractRoles(user),
                extractPermissions(user),
                extractOrganizations(user)
        );

        String refreshToken = jwtCreateService.generateRefreshToken(user.getId(), user.getUsername());

        return TokenResponseDto.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtCreateService.getExpirationMs())
                .user(userManagementMapper.toResponseDto(user))
                .build();
    }

    private void validatePasswordChange(ChangePasswordRequestDto request, User user) {
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new RuntimeException("Current password is incorrect");
        }
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new RuntimeException("New password and confirmation do not match");
        }
    }

    // ============================================================
    // ПРИВАТНЫЕ МЕТОДЫ — COOKIE
    // ============================================================


    private String extractTokenFromCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            String cookieName = cookieProperties.getName();
            for (Cookie cookie : cookies) {
                if (cookieName.equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    /**
     * Приватный метод для отправки события
     */
    private void sendUserCreateEvent(User user) {
        try {
            var event = userManagementMapper.toUserCreatedEvent(user);

            commandSender.sendCommand(CommandMessageType.USER_CREATED, event);
            log.info("User created event sent for user: {}", user.getUsername());
        } catch (Exception e) {
            // Не даём упасть приложению, если RabbitMQ недоступен
            log.error("Failed to send user created event for user: {}", user.getUsername(), e);
        }
    }
}