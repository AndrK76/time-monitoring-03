package ru.igorit.monitoring.security.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static ru.igorit.monitoring.security.util.JwtUtils.getSigningKey;

@Service
@Slf4j
public class JwtService {

    @Value("${security.jwt.secret}")
    private String secret;

    private final Map<String, Long> invalidatedTokens = new ConcurrentHashMap<>();


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
    public List<String> extractRoles(String token) {
        try {
            Claims claims = extractAllClaims(token);
            Object roles = claims.get("roles");
            if (roles instanceof List) {
                return (List<String>) roles;
            }
            return List.of();
        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * Извлечение прав из токена
     */
    @SuppressWarnings("unchecked")
    public List<String> extractPermissions(String token) {
        try {
            Claims claims = extractAllClaims(token);
            Object permissions = claims.get("permissions");
            if (permissions instanceof List) {
                return (List<String>) permissions;
            }
            return List.of();
        } catch (Exception e) {
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    public List<String> extractAllowedOrganizations(String token) {
        try {
            Claims claims = extractAllClaims(token);
            Object organizations = claims.get("allowedOrganizations");
            if (organizations instanceof List) {
                return (List<String>) organizations;
            }
            return List.of();
        } catch (Exception e) {
            return List.of();
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
                .verifyWith(getSigningKey(secret))
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
            var ret = !claims.getExpiration().before(new Date());
            return ret;
        } catch (Exception e) {
            log.debug("Token validation failed: {}", e.getMessage());
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
        /*long now = System.currentTimeMillis();
        invalidatedTokens.entrySet().removeIf(entry ->
                (now - entry.getValue()) > refreshExpirationMs
        );*/
        log.debug("Invalidated tokens cleaned up");
    }
}