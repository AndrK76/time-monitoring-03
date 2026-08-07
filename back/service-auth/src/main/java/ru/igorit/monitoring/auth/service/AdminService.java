// service-auth/src/main/java/ru/igorit/monitoring/auth/service/AdminService.java
package ru.igorit.monitoring.auth.service;

import ru.igorit.monitoring.persistence.entity.User;
import ru.igorit.monitoring.persistence.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Обновление пароля для конкретного пользователя
     */
    @Transactional
    public String updatePassword(String username, String newPassword) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        String encodedPassword = passwordEncoder.encode(newPassword);
        user.setPassword(encodedPassword);
        userRepository.save(user);

        log.info("Password updated for user: {}", username);
        return "Password updated successfully for user: " + username;
    }
}