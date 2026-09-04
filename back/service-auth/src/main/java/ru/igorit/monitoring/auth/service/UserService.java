package ru.igorit.monitoring.auth.service;

import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.server.ResponseStatusException;
import ru.igorit.monitoring.persistence.entity.auth.User;
import ru.igorit.monitoring.persistence.entity.auth.UserAuthProvider;
import ru.igorit.monitoring.auth.repository.UserAuthProviderRepository;
import ru.igorit.monitoring.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final UserAuthProviderRepository authProviderRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public User createLocalUser(String username, String email, String password,
                                String firstName, String lastName, String displayName, String creatorId) {
        if (userRepository.existsByUsername(username)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username already exists: " + username);
        }
        if (email != null && userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already exists: " + email);
        }

        User user = User.builder()
                .username(username)
                .email(email)
                //.password(passwordEncoder.encode(password))
                .firstName(firstName)
                .lastName(lastName)
                .displayName(displayName)
                .isActive(true)
                .isEmailVerified(false)
                .createdBy(creatorId)
                .build();
        if (!isBlank(password)) {
            user.setPassword(passwordEncoder.encode(password));
        }

        UserAuthProvider localProvider = UserAuthProvider.builder()
                .providerName("LOCAL")
                .providerUserId(username)
                .providerEmail(email)
                .linkedAt(LocalDateTime.now())
                .providerData(null)
                .build();

        user.addAuthProvider(localProvider);

        User savedUser = userRepository.save(user);
        log.info("Created local user: {}", username);

        return savedUser;
    }

    @Transactional
    public User findOrCreateOAuthUser(String providerName, String providerUserId,
                                      String email, String firstName, String lastName,
                                      String avatarUrl, String accessToken,
                                      String refreshToken, LocalDateTime tokenExpiresAt) {

        Optional<User> existingUser = userRepository.findByProvider(providerName, providerUserId);
        if (existingUser.isPresent()) {
            User user = existingUser.get();
            updateProviderData(user, providerName, providerUserId, email, accessToken, refreshToken, tokenExpiresAt);
            user.setLastLoginAt(LocalDateTime.now());
            return userRepository.save(user);
        }

        if (email != null) {
            Optional<User> userByEmail = userRepository.findByEmail(email);
            if (userByEmail.isPresent()) {
                User user = userByEmail.get();
                addProviderToUser(user, providerName, providerUserId, email, accessToken, refreshToken, tokenExpiresAt);
                user.setLastLoginAt(LocalDateTime.now());
                return userRepository.save(user);
            }
        }

        return createOAuthUser(providerName, providerUserId, email, firstName, lastName,
                avatarUrl, accessToken, refreshToken, tokenExpiresAt);
    }

    @Transactional
    public User createOAuthUser(String providerName, String providerUserId,
                                String email, String firstName, String lastName,
                                String avatarUrl, String accessToken,
                                String refreshToken, LocalDateTime tokenExpiresAt) {

        String username = generateUsernameFromProvider(providerName, providerUserId, email);

        User user = User.builder()
                .username(username)
                .email(email)
                .firstName(firstName)
                .lastName(lastName)
                .avatarUrl(avatarUrl)
                .isActive(true)
                .isEmailVerified(email != null)
                .lastLoginAt(LocalDateTime.now())
                .build();

        UserAuthProvider provider = UserAuthProvider.builder()
                .providerName(providerName)
                .providerUserId(providerUserId)
                .providerEmail(email)
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenExpiresAt(tokenExpiresAt)
                .linkedAt(LocalDateTime.now())
                .lastUsedAt(LocalDateTime.now())
                .build();

        user.addAuthProvider(provider);

        User savedUser = userRepository.save(user);
        log.info("Created user from provider {}: {}", providerName, username);

        return savedUser;
    }

    @Transactional
    public void addProviderToUser(User user, String providerName, String providerUserId,
                                  String email, String accessToken, String refreshToken,
                                  LocalDateTime tokenExpiresAt) {

        if (user.hasAuthProvider(providerName)) {
            updateProviderData(user, providerName, providerUserId, email, accessToken, refreshToken, tokenExpiresAt);
        } else {
            UserAuthProvider provider = UserAuthProvider.builder()
                    .providerName(providerName)
                    .providerUserId(providerUserId)
                    .providerEmail(email)
                    .accessToken(accessToken)
                    .refreshToken(refreshToken)
                    .tokenExpiresAt(tokenExpiresAt)
                    .linkedAt(LocalDateTime.now())
                    .lastUsedAt(LocalDateTime.now())
                    .build();

            user.addAuthProvider(provider);
            userRepository.save(user);
            log.info("Added provider {} to user {}", providerName, user.getUsername());
        }
    }

    @Transactional
    public void updateProviderData(User user, String providerName, String providerUserId,
                                   String email, String accessToken, String refreshToken,
                                   LocalDateTime tokenExpiresAt) {

        UserAuthProvider provider = user.getAuthProvider(providerName);
        if (provider != null) {
            provider.setProviderUserId(providerUserId);
            provider.setProviderEmail(email);
            provider.setAccessToken(accessToken);
            provider.setRefreshToken(refreshToken);
            provider.setTokenExpiresAt(tokenExpiresAt);
            provider.setLastUsedAt(LocalDateTime.now());

            if (email != null && !email.equals(user.getEmail())) {
                user.setEmail(email);
                user.setIsEmailVerified(true);
            }

            authProviderRepository.save(provider);
            log.info("Updated provider {} for user {}", providerName, user.getUsername());
        }
    }

    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public Optional<User> findById(String id) {
        return userRepository.findById(id);
    }

    private String generateUsernameFromProvider(String providerName, String providerUserId, String email) {
        String base;
        if (email != null && !email.isEmpty()) {
            base = email.split("@")[0];
        } else {
            base = providerName.toLowerCase() + "_" + providerUserId;
        }

        String username = base;
        int counter = 1;
        while (userRepository.existsByUsername(username)) {
            username = base + "_" + counter;
            counter++;
        }

        return username;
    }
}