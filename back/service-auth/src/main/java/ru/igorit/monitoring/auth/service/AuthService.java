package ru.igorit.monitoring.auth.service;

import jakarta.servlet.http.Cookie;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import ru.igorit.monitoring.auth.dto.*;
import ru.igorit.monitoring.auth.mapper.UserMapper;
import ru.igorit.monitoring.persistence.entity.User;
import ru.igorit.monitoring.persistence.repository.UserRepository;
import ru.igorit.monitoring.security.config.CookieProperties;
import ru.igorit.monitoring.security.service.JwtService;
import ru.igorit.monitoring.security.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

import static ru.igorit.monitoring.common.AuthConstants.ANONYMOUS_USER;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserService userService;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final CookieProperties cookieProperties;

    @Transactional
    public TokenResponse login(LoginRequest request, HttpServletResponse response) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);

        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<String> roles = user.getRoles().stream()
                .map(role -> role.getName())
                .collect(Collectors.toList());

        List<String> permissions = user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(permission -> permission.getName())
                .collect(Collectors.toList());

        String accessToken = jwtService.generateToken(user.getId(), user.getUsername(), roles, permissions);
        String refreshToken = jwtService.generateRefreshToken(user.getId(), user.getUsername());

        // Создаем HttpOnly cookie для SSO
        addAuthCookie(response, accessToken);

        return TokenResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(86400L)
                .user(userMapper.toResponse(user))
                .build();
    }

    /**
     * Регистрация нового пользователя
     */
    @Transactional
    public TokenResponse register(RegistrationRequest request) {
        User user = userService.createLocalUser(
                request.getUsername(),
                request.getEmail(),
                request.getPassword(),
                request.getFirstName(),
                request.getLastName(),
                request.getDisplayName()
        );

        List<String> roles = user.getRoles().stream()
                .map(role -> role.getName())
                .collect(Collectors.toList());

        List<String> permissions = user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(permission -> permission.getName())
                .collect(Collectors.toList());

        String accessToken = jwtService.generateToken(user.getId(), user.getUsername(), roles, permissions);
        String refreshToken = jwtService.generateRefreshToken(user.getId(), user.getUsername());

        return TokenResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(86400L)
                .user(userMapper.toResponse(user))
                .build();
    }

    /**
     * Смена пароля текущего пользователя
     */
    @Transactional
    public void changePassword(ChangePasswordRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new RuntimeException("User not authenticated");
        }

        User user = userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Проверяем текущий пароль
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new RuntimeException("Current password is incorrect");
        }

        // Проверяем, что новый пароль и подтверждение совпадают
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new RuntimeException("New password and confirmation do not match");
        }

        // Хешируем и сохраняем новый пароль
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        log.info("Password changed for user: {}", user.getUsername());
    }


    public TokenResponse refreshToken(String refreshToken) {
        if (!jwtService.validateRefreshToken(refreshToken)) {
            throw new RuntimeException("Invalid refresh token");
        }

        String userId = jwtService.extractUserId(refreshToken);
        String username = jwtService.extractUsername(refreshToken);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<String> roles = user.getRoles().stream()
                .map(role -> role.getName())
                .collect(Collectors.toList());

        List<String> permissions = user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(permission -> permission.getName())
                .collect(Collectors.toList());

        String newAccessToken = jwtService.generateToken(userId, username, roles, permissions);

        return TokenResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(86400L)
                .user(userMapper.toResponse(user))
                .build();
    }

    public void logout(HttpServletRequest request, HttpServletResponse response) {
        // 1. Извлекаем токен из cookie
        String token = extractTokenFromCookie(request);

        // 2. Инвалидируем токен в JwtService (черный список)
        if (token != null) {
            jwtService.invalidateToken(token);
            log.info("Token invalidated");
        }

        // 3. Удаляем cookie
        removeAuthCookie(request, response);

        // 4. Очищаем SecurityContext
        SecurityContextHolder.clearContext();

        log.info("User logged out");
    }

    /**
     * Выход с инвалидацией по токену из заголовка (для API клиентов)
     */
    public void logout(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            jwtService.invalidateToken(token);
            log.info("Token invalidated from header");
        }
        SecurityContextHolder.clearContext();
    }

    public UserResponse getCurrentUser(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userName = null;
        if (auth == null || !auth.isAuthenticated() || ANONYMOUS_USER.equals(auth.getPrincipal())) {
            String token = extractTokenFromCookie(request);
            if (token != null && jwtService.isTokenValid(token)) {
                userName = jwtService.extractUsername(token);
            } else if (auth != null) {
                userName = auth.getName();
            }
        }
        User user = (userName == null || ANONYMOUS_USER.equals(userName)) ? User.anonymous()
                : userRepository.findByUsername(userName)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return userMapper.toResponse(user);
    }

    /**
     * Проверка аутентификации по cookie
     */
    public TokenResponse checkAuth(HttpServletRequest request) {
        String token = extractTokenFromCookie(request);
        if (token == null || !jwtService.isTokenValid(token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired token");
        }

        String username = jwtService.extractUsername(token);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        //return userMapper.toResponse(user);

        List<String> roles = user.getRoles().stream()
                .map(role -> role.getName())
                .collect(Collectors.toList());

        List<String> permissions = user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(permission -> permission.getName())
                .collect(Collectors.toList());

        // Генерируем новый токен (или возвращаем существующий из куки)
        String newToken = jwtService.generateToken(user.getId(), user.getUsername(), roles, permissions);

        return TokenResponse.builder()
                .accessToken(newToken)
                .tokenType("Bearer")
                .expiresIn(86400L)
                .user(userMapper.toResponse(user))
                .build();
    }


    // ============================================================
    // Приватные методы для работы с cookie
    // ============================================================

    private void addAuthCookie(HttpServletResponse response, String token) {
        try {
            Cookie cookie = new Cookie(cookieProperties.getName(), token);
            cookie.setHttpOnly(cookieProperties.isHttpOnly());
            cookie.setSecure(cookieProperties.isSecure());
            cookie.setPath(cookieProperties.getPath());
            cookie.setMaxAge(cookieProperties.getMaxAge());
            if (cookieProperties.getDomain() != null && !cookieProperties.getDomain().isEmpty()) {
                cookie.setDomain(cookieProperties.getDomain());
            }
            response.addCookie(cookie);
            log.debug("Auth cookie added with domain: {}", cookieProperties.getDomain());
        } catch (Exception e) {
            log.error("Failed to add auth cookie", e);
        }
    }

    private void removeAuthCookie(HttpServletRequest request, HttpServletResponse response) {
        try {
            Cookie cookie = new Cookie(cookieProperties.getName(), null);
            cookie.setHttpOnly(cookieProperties.isHttpOnly());
            cookie.setSecure(cookieProperties.isSecure());
            cookie.setPath(cookieProperties.getPath());
            cookie.setMaxAge(0);
            if (cookieProperties.getDomain() != null && !cookieProperties.getDomain().isEmpty()) {
                cookie.setDomain(cookieProperties.getDomain());
            }
            response.addCookie(cookie);
        } catch (Exception e) {
            log.error("Failed to remove auth cookie", e);
        }
    }

    private String extractTokenFromCookie(HttpServletRequest request) {
        log.debug("Extracting token from cookie ");
        Cookie[] cookies = request.getCookies();
        log.debug("Extracting token from cookie cookies count={}", cookies == null ? "null" : cookies.length);
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("auth_token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }


    /**
     * Обработка callback от OAuth2 провайдера
     */
    public TokenResponse handleOAuth2Callback(String provider, String code) {
        log.info("OAuth2 callback from provider: {}, code: {}", provider, code);

        // TODO: Реализовать полноценную OAuth2 аутентификацию
        // Пока возвращаем заглушку или ошибку
        throw new UnsupportedOperationException(
                "OAuth2 authentication not yet implemented. Provider: " + provider
        );
    }

    /**
     * OAuth2 логин (вход через провайдера)
     * Используется для редиректа на страницу провайдера
     */
    public String getOAuth2AuthorizationUrl(String provider) {
        log.info("Getting OAuth2 authorization URL for provider: {}", provider);
        // TODO: Реализовать получение URL для OAuth2 провайдера
        // Пока возвращаем заглушку
        return "/oauth2/authorization/" + provider;
    }
}