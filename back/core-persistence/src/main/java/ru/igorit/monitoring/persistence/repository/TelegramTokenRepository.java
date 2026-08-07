package ru.igorit.monitoring.persistence.repository;

import ru.igorit.monitoring.persistence.entity.TelegramToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface TelegramTokenRepository extends JpaRepository<TelegramToken, String> {

    Optional<TelegramToken> findByTokenAndIsUsedFalse(String token);

    @Modifying
    @Transactional
    @Query("UPDATE TelegramToken t SET t.isUsed = true, t.usedAt = :usedAt WHERE t.token = :token")
    void markAsUsed(@Param("token") String token, @Param("usedAt") LocalDateTime usedAt);

    void deleteByExpiresAtBefore(LocalDateTime now);

    @Query("SELECT t FROM TelegramToken t WHERE t.user.id = :userId AND t.isUsed = false AND t.expiresAt > :now")
    Optional<TelegramToken> findValidTokenByUserId(@Param("userId") String userId, @Param("now") LocalDateTime now);
}