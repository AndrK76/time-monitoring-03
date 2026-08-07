// core-security/src/main/java/ru/igorit/monitoring/security/service/JwtService.java
package ru.igorit.monitoring.security.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class JwtService {

    @Value("${security.jwt.secret}")
    private String secret;


    @Value("${security.jwt.expiration:86400000}")
    private long expirationMs;

    @Value("${security.jwt.refresh-expiration:604800000}")
    private long refreshExpirationMs;

    private final Map<String, Long> invalidatedTokens = new ConcurrentHashMap<>();

    /**
     * Получение ключа для подписи
     */
    private SecretKey getSigningKey() {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    /**
     * Генерация access токена с ролями и правами
     */
    public String generateToken(String userId, String username,
                                java.util.List<String> roles,
                                java.util.List<String> permissions) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userId);
        claims.put("username", username);
        claims.put("roles", roles != null ? roles : java.util.List.of());
        claims.put("permissions", permissions != null ? permissions : java.util.List.of());

        return Jwts.builder()
                .claims(claims)
                .subject(username)
                .issuedAt(new Date())
                .expiration(Date.from(Instant.now().plus(expirationMs, ChronoUnit.MILLIS)))
                .signWith(getSigningKey())
                .compact();
    }

    /**
     * Генерация access токена (упрощенный вариант)
     */
    public String generateToken(String userId, String username) {
        return generateToken(userId, username, java.util.List.of(), java.util.List.of());
    }

    /**
     * Генерация refresh токена
     */
    public String generateRefreshToken(String userId, String username) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userId);
        claims.put("type", "refresh");

        return Jwts.builder()
                .claims(claims)
                .subject(username)
                .issuedAt(new Date())
                .expiration(Date.from(Instant.now().plus(refreshExpirationMs, ChronoUnit.MILLIS)))
                .signWith(getSigningKey())
                .compact();
    }

    /**
     * Извлечение username из токена
     */
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    /**
     * Извлечение userId из токена
     */
    public String extractUserId(String token) {
        return extractClaim(token, claims -> claims.get("userId", String.class));
    }

    /**
     * Извлечение ролей из токена
     */
    @SuppressWarnings("unchecked")
    public java.util.List<String> extractRoles(String token) {
        try {
            Claims claims = extractAllClaims(token);
            Object roles = claims.get("roles");
            if (roles instanceof java.util.List) {
                return (java.util.List<String>) roles;
            }
            return java.util.List.of();
        } catch (Exception e) {
            return java.util.List.of();
        }
    }

    /**
     * Извлечение прав из токена
     */
    @SuppressWarnings("unchecked")
    public java.util.List<String> extractPermissions(String token) {
        try {
            Claims claims = extractAllClaims(token);
            Object permissions = claims.get("permissions");
            if (permissions instanceof java.util.List) {
                return (java.util.List<String>) permissions;
            }
            return java.util.List.of();
        } catch (Exception e) {
            return java.util.List.of();
        }
    }

    /**
     * Извлечение конкретного claim
     */
    public <T> T extractClaim(String token, java.util.function.Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    /**
     * Извлечение всех claims из токена
     */
    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /**
     * Проверка валидности токена
     */
    public boolean isTokenValid(String token) {
        try {
            if (invalidatedTokens.containsKey(token)) {
                log.debug("Token has been invalidated");
                return false;
            }
            Claims claims = extractAllClaims(token);
            return !claims.getExpiration().before(new Date());
        } catch (Exception e) {
            log.debug("Token validation failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Проверка refresh токена
     */
    public boolean validateRefreshToken(String token) {
        try {
            Claims claims = extractAllClaims(token);
            if (claims.get("type") == null || !"refresh".equals(claims.get("type"))) {
                return false;
            }
            return !claims.getExpiration().before(new Date());
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Инвалидация токена (добавление в черный список)
     */
    public void invalidateToken(String token) {
        invalidatedTokens.put(token, System.currentTimeMillis());
        log.debug("Token invalidated");
    }

    /**
     * Очистка черного списка токенов (старые записи)
     */
    public void cleanInvalidatedTokens() {
        long now = System.currentTimeMillis();
        invalidatedTokens.entrySet().removeIf(entry ->
                (now - entry.getValue()) > refreshExpirationMs
        );
        log.debug("Invalidated tokens cleaned up");
    }
}