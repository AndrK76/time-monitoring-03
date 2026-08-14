package ru.igorit.monitoring.persistence.entity.auth;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "telegram_tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TelegramToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false, unique = true)
    private String token;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "telegram_user_id")
    private String telegramUserId;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "is_used")
    @Builder.Default
    private Boolean isUsed = false;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "target_url")
    private String targetUrl;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}