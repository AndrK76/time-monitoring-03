package ru.igorit.monitoring.security.service;

import ru.igorit.monitoring.persistence.entity.auth.TelegramToken;
import ru.igorit.monitoring.persistence.entity.auth.User;
import ru.igorit.monitoring.persistence.repository.auth.TelegramTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class TelegramTokenService {

    private final TelegramTokenRepository telegramTokenRepository;

    @Value("${security.telegram.token-ttl:300}")
    private long tokenTtlSeconds;

    @Transactional
    public String generateToken(User user, String telegramUserId, String targetUrl) {
        String token = UUID.randomUUID().toString();

        TelegramToken telegramToken = TelegramToken.builder()
                .token(token)
                .user(user)
                .telegramUserId(telegramUserId)
                .expiresAt(LocalDateTime.now().plusSeconds(tokenTtlSeconds))
                .isUsed(false)
                .targetUrl(targetUrl)
                .build();

        telegramTokenRepository.save(telegramToken);
        log.info("Generated telegram token for user: {}", user.getUsername());

        return token;
    }

    @Transactional
    public Optional<User> validateAndConsumeToken(String token) {
        Optional<TelegramToken> tokenOpt = telegramTokenRepository.findByTokenAndIsUsedFalse(token);

        if (tokenOpt.isEmpty()) {
            log.warn("Telegram token not found or already used: {}", token);
            return Optional.empty();
        }

        TelegramToken telegramToken = tokenOpt.get();

        if (telegramToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            log.warn("Telegram token expired: {}", token);
            return Optional.empty();
        }

        telegramToken.setIsUsed(true);
        telegramToken.setUsedAt(LocalDateTime.now());
        telegramTokenRepository.save(telegramToken);

        log.info("Telegram token consumed for user: {}", telegramToken.getUser().getUsername());

        return Optional.of(telegramToken.getUser());
    }

    @Transactional
    public void cleanupExpiredTokens() {
        telegramTokenRepository.deleteByExpiresAtBefore(LocalDateTime.now());
        log.info("Cleaned up expired telegram tokens");
    }

    public Optional<TelegramToken> findValidTokenByUserId(String userId) {
        return telegramTokenRepository.findValidTokenByUserId(userId, LocalDateTime.now());
    }
}