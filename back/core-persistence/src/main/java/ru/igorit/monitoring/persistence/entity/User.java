package ru.igorit.monitoring.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

import static ru.igorit.monitoring.common.AuthConstants.ANONYMOUS_USER;
import static ru.igorit.monitoring.common.AuthConstants.ANONYMOUS_USERID;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(unique = true)
    private String email;

    private String password;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "phone_number")
    private String phoneNumber;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "is_email_verified")
    @Builder.Default
    private Boolean isEmailVerified = false;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "created_by", updatable = false)
    private String createdBy;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "updated_by")
    private String updatedBy;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private Set<UserAuthProvider> authProviders = new HashSet<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "user_roles",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    @Builder.Default
    private Set<Role> roles = new HashSet<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private Set<TelegramToken> telegramTokens = new HashSet<>();

    public void addAuthProvider(UserAuthProvider provider) {
        authProviders.add(provider);
        provider.setUser(this);
    }

    public UserAuthProvider getAuthProvider(String providerName) {
        return authProviders.stream()
                .filter(p -> p.getProviderName().equalsIgnoreCase(providerName))
                .findFirst()
                .orElse(null);
    }

    public boolean hasAuthProvider(String providerName) {
        return authProviders.stream()
                .anyMatch(p -> p.getProviderName().equalsIgnoreCase(providerName));
    }

    public void addTelegramToken(TelegramToken token) {
        telegramTokens.add(token);
        token.setUser(this);
    }

    public static User anonymous() {
        var ret = new  User();
        ret.setUsername(ANONYMOUS_USER);
        ret.setId(ANONYMOUS_USERID);
        ret.setDisplayName("Анонимный пользователь");
        return ret;
    }

    public boolean isAnonymous() {
        return this.id == null && ANONYMOUS_USER.equals(this.username);
    }
}