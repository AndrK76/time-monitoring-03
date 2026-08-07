package ru.igorit.monitoring.auth.controller;

import ru.igorit.monitoring.auth.dto.TokenResponse;
import ru.igorit.monitoring.auth.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/oauth2")
@RequiredArgsConstructor
@Slf4j
public class OAuth2Controller {

    private final AuthService authService;

    @GetMapping("/callback")
    public TokenResponse handleOAuth2Callback(
            @RequestParam String code,
            @RequestParam String provider) {
        log.info("OAuth2 callback from provider: {}", provider);
        return authService.handleOAuth2Callback(provider, code);
    }
}