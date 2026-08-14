package ru.igorit.monitoring.auth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.igorit.monitoring.persistence.entity.auth.User;
import ru.igorit.monitoring.auth.repository.UserRepository;
import ru.igorit.monitoring.security.model.UserPrincipal;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;
    private final ResetPasswordService resetPasswordService;

    @Value("${DEFAULT_PASSWORD:}")
    private String defaultPassword;


    @Override
    @Transactional
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        log.debug("Loaded user: {}", username);
        resetPasswordService.setDefaultPasswordIfEmpty(user);
        return new UserPrincipal(user);
    }


}