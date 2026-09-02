package ru.igorit.monitoring.security.service;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.log4j.Log4j2;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Service;
import ru.igorit.monitoring.security.util.JwtUtils;

@Service
//@ConditionalOnMissingBean(CookieService.class)
@Log4j2
public class CookieServiceBase implements CookieService {
    @Override
    public void addAuthCookie(HttpServletResponse response, String token) {
        log.warn("Not implemented");
    }

    @Override
    public void removeAuthCookie(HttpServletRequest request, HttpServletResponse response) {
        log.warn("Not implemented");
    }

    @Override
    public String extractToken(HttpServletRequest request) {
        return JwtUtils.extractToken(request);
    }
}
