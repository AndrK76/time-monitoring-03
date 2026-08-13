package ru.igorit.monitoring.security.service;

import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.igorit.monitoring.persistence.entity.User;
import ru.igorit.monitoring.persistence.repository.UserRepository;

@Service
@RequiredArgsConstructor
@Slf4j
public class ResetPasswordService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${DEFAULT_PASSWORD:}")
    private String defaultPassword;

    /**
     * Проверяет, пустой ли пароль у пользователя
     */
    public boolean isPasswordEmpty(User user) {
        return user == null || user.getPassword() == null || user.getPassword().isBlank();
    }

    /**
     * Устанавливает пароль по умолчанию для пользователя
     * (используется при логине, если пароль пустой)
     */
    @Transactional
    public void setDefaultPasswordIfEmpty(@NonNull User user) {
        if (!isPasswordEmpty(user)) {
            return;
        }
        setDefaultPassword(user);
    }

    /**
     * Принудительно устанавливает пароль по умолчанию для пользователя
     * (используется админом для сброса пароля)
     */
    @Transactional
    public void setDefaultPassword(@NonNull User user) {
        if (defaultPassword == null || defaultPassword.isBlank()) {
            throw new IllegalStateException("Default password is not configured. " +
                    "Please set DEFAULT_PASSWORD in configuration.");
        }
        setPassword(user, defaultPassword, true);
    }

    @Transactional
    public void setPassword(@NonNull User user, String password) {
        setPassword(user, password, false);
    }

    private void setPassword(@NonNull User user, String password, boolean isDefault) {
        if (password == null || password.isBlank()) {
            throw new IllegalArgumentException("New password cannot be empty");
        }
        String encoded = passwordEncoder.encode(password);
        user.setPassword(encoded);
        userRepository.save(user);
        log.info("{} password set for user: {}", isDefault?"Default":"New", user.getUsername());
    }

}