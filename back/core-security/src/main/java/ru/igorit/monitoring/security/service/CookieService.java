package ru.igorit.monitoring.security.service;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public interface CookieService {
    void addAuthCookie(HttpServletResponse response, String token);

    void removeAuthCookie(HttpServletRequest request, HttpServletResponse response);

    String extractToken(HttpServletRequest request);
}
