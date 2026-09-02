package ru.igorit.monitoring.auth.service.secur;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import ru.igorit.monitoring.security.service.JwtService;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static ru.igorit.monitoring.security.util.JwtUtils.getSigningKey;

@Service
@RequiredArgsConstructor
public class JwtCreateService {
    @Value("${security.jwt.secret}")
    private String secret;


    @Value("${security.jwt.expiration:86400000}")
    @Getter
    private long expirationMs;

    @Value("${security.jwt.refresh-expiration:604800000}")
    @Getter
    private long refreshExpirationMs;

    private final JwtService jwtService;


    /**
     * Генерация access токена с ролями и правами
     */
    public String generateToken(String userId, String username,
                                List<String> roles,
                                List<String> permissions,
                                List<String> allowedOrganizations) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userId);
        claims.put("username", username);
        claims.put("roles", roles != null ? roles : List.of());
        claims.put("permissions", permissions != null ? permissions : List.of());
        claims.put("allowedOrganizations", allowedOrganizations != null ? allowedOrganizations : List.of());

        return Jwts.builder()
                .claims(claims)
                .subject(username)
                .issuedAt(new Date())
                .expiration(Date.from(Instant.now().plus(expirationMs, ChronoUnit.MILLIS)))
                .signWith(getSigningKey(secret))
                .compact();
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
                .signWith(getSigningKey(secret))
                .compact();
    }

    /**
     * Проверка refresh токена
     */
    public boolean validateRefreshToken(String token) {
        try {
            Claims claims = jwtService.extractAllClaims(token);
            if (claims.get("type") == null || !"refresh".equals(claims.get("type"))) {
                return false;
            }
            return !claims.getExpiration().before(new Date());
        } catch (Exception e) {
            return false;
        }
    }
}
