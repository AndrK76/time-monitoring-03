package ru.igorit.monitoring.security.util;

import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.HttpServletRequest;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

public class JwtUtils {

    /**
     * Имя куки с токеном
     */
    public static final String COOKIE_NAME = "auth_token";

    /**
     * Получение ключа для подписи
     */
    public static SecretKey getSigningKey(String secret) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    /**
     * Извлечь токен из заголовка Authorization
     */
    public static String extractToken(HttpServletRequest request) {
        //Проверяем Authorization header
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }
}
