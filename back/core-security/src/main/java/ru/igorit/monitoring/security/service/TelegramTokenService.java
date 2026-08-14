package ru.igorit.monitoring.security.service;

import ru.igorit.monitoring.persistence.entity.auth.User;

import java.util.Optional;

public interface TelegramTokenService {
    String generateToken(User user, String telegramUserId, String targetUrl);

    Optional<User> validateAndConsumeToken(String token);

    void cleanupExpiredTokens();
}
