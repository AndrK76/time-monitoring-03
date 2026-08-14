package ru.igorit.monitoring.persistence.entity.auth;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_auth_providers",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"provider_name", "provider_user_id"})
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserAuthProvider {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "provider_name", nullable = false)
    private String providerName;

    @Column(name = "provider_user_id", nullable = false)
    private String providerUserId;

    @Column(name = "provider_email")
    private String providerEmail;

    @Column(name = "access_token")
    private String accessToken;

    @Column(name = "refresh_token")
    private String refreshToken;

    @Column(name = "token_expires_at")
    private LocalDateTime tokenExpiresAt;

    @Column(name = "linked_at")
    private LocalDateTime linkedAt;

    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;

    @Column(name = "provider_data", length = Integer.MAX_VALUE)
    private String providerData;
}