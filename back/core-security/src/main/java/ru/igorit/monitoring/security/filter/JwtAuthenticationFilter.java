package ru.igorit.monitoring.security.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import ru.igorit.monitoring.security.model.JwtAuthenticationToken;
import ru.igorit.monitoring.security.service.CookieService;
import ru.igorit.monitoring.security.service.JwtService;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {


    private final JwtService jwtService;
    private final CookieService cookieService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        var token = cookieService.extractToken(request);
        if (token == null) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            if (jwtService.isTokenValid(token)) {
                log.debug("JWT token valid");
                String userId = jwtService.extractUserId(token);
                String username = jwtService.extractUsername(token);
                List<String> roles = jwtService.extractRoles(token);
                List<String> permissions = jwtService.extractPermissions(token);
                List<String> allowedOrganizations = jwtService.extractAllowedOrganizations(token);

                JwtAuthenticationToken authentication = new JwtAuthenticationToken(
                        userId,
                        username,
                        roles != null ? roles : List.of(),
                        permissions != null ? permissions : List.of(),
                        allowedOrganizations != null ? allowedOrganizations : List.of(),
                        token
                );

                SecurityContextHolder.getContext().setAuthentication(authentication);

                log.debug("Authenticated user: {} with roles: {}, permissions: {}",
                        username,
                        authentication.getRoles(),
                        authentication.getPermissions());
            } else {
                log.debug("JWT token invalid, request: {}", request.getRequestURI());
            }
        } catch (Exception e) {
            log.warn("request: {}, Invalid JWT token: {}", request.getRequestURI(), e.getMessage());
        }
        filterChain.doFilter(request, response);
    }


}