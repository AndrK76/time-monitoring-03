package ru.igorit.monitoring.auth.service;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import ru.igorit.monitoring.security.config.CookieProperties;

@Service
@RequiredArgsConstructor
@Log4j2
public class CookieService {
    private final CookieProperties cookieProperties;

    public void addAuthCookie(HttpServletResponse response, String token) {
        try {
            Cookie cookie = new Cookie(cookieProperties.getName(), token);
            cookie.setHttpOnly(cookieProperties.isHttpOnly());
            cookie.setSecure(cookieProperties.isSecure());
            cookie.setPath(cookieProperties.getPath());
            cookie.setMaxAge(cookieProperties.getMaxAge());
            if (cookieProperties.getDomain() != null && !cookieProperties.getDomain().isEmpty()) {
                cookie.setDomain(cookieProperties.getDomain());
            }
            response.addCookie(cookie);
            log.debug("Auth cookie added with domain: {}", cookieProperties.getDomain());
        } catch (Exception e) {
            log.error("Failed to add auth cookie", e);
        }
    }

    public void removeAuthCookie(HttpServletRequest request, HttpServletResponse response) {
        try {
            Cookie cookie = new Cookie(cookieProperties.getName(), null);
            cookie.setHttpOnly(cookieProperties.isHttpOnly());
            cookie.setSecure(cookieProperties.isSecure());
            cookie.setPath(cookieProperties.getPath());
            cookie.setMaxAge(0);
            if (cookieProperties.getDomain() != null && !cookieProperties.getDomain().isEmpty()) {
                cookie.setDomain(cookieProperties.getDomain());
            }
            response.addCookie(cookie);
        } catch (Exception e) {
            log.error("Failed to remove auth cookie", e);
        }
    }
}
