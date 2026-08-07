package ru.igorit.monitoring.security.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import ru.igorit.monitoring.persistence.entity.User;
import ru.igorit.monitoring.persistence.repository.UserRepository;
import ru.igorit.monitoring.security.model.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${DEFAULT_PASSWORD:}")
    private String defaultPassword;


    @Override
    @Transactional
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        log.debug("Loaded user: {}", username);

        if (isPasswordEmpty(user)) {
            log.warn("Stored password not set, user: {}", user.getUsername());
            setDefaultPassword(user);
        }
        return new UserPrincipal(user);
    }

    private boolean isPasswordEmpty(User user) {
        return user.getPassword() == null || user.getPassword().isBlank();
    }

    private void setDefaultPassword(User user) {
        if (defaultPassword == null || defaultPassword.isBlank()) {
            log.warn("DEFAULT_ADMIN_PASSWORD not set. Cannot set password for user: {}", user.getUsername());
            return;
        }
        String encoded = passwordEncoder.encode(defaultPassword);
        user.setPassword(encoded);
        userRepository.save(user);
        log.info("Default password set for user: {}", user.getUsername());
    }
}