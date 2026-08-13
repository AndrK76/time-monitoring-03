package ru.igorit.monitoring.auth.helper;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class AuthErrorHelper {

    private final LoginMessageHelper loginMessageHelper;
    private final LocaleHelper localeHelper;

    public ResponseEntity<?> handleLoginError(Exception e, String username) {
        HttpServletRequest request = getCurrentRequest();
        String path = request != null ? request.getRequestURI() : "";
        Locale locale = localeHelper.getCurrentLocale();

        Map<String, Object> errorResponse = new LinkedHashMap<>();
        errorResponse.put("timestamp", LocalDateTime.now().toString());
        errorResponse.put("path", path);
        errorResponse.put("username", username);
        errorResponse.put("locale", locale.getLanguage());

        String code = getErrorCode(e);
        String message = loginMessageHelper.getLocalizedMessage(e);
        HttpStatus status = getHttpStatus(e);

        log.warn("Login failed - {} for user: {}", code, username);

        errorResponse.put("status", status.value());
        errorResponse.put("error", status.getReasonPhrase());
        errorResponse.put("code", code);
        errorResponse.put("message", message);

        return ResponseEntity.status(status).body(errorResponse);
    }

    private String getErrorCode(Exception e) {
        String className = e.getClass().getSimpleName();
        if (className.endsWith("Exception")) {
            className = className.substring(0, className.length() - 9);
        }
        return className.toUpperCase();
    }

    private HttpStatus getHttpStatus(Exception e) {
        if (e instanceof LockedException) {
            return HttpStatus.FORBIDDEN;
        }
        if (e instanceof BadCredentialsException) {
            return HttpStatus.UNAUTHORIZED;
        }
        if (e instanceof UsernameNotFoundException) {
            return HttpStatus.UNAUTHORIZED;
        }
        if (e instanceof AuthenticationException) {
            return HttpStatus.UNAUTHORIZED;
        }
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    private HttpServletRequest getCurrentRequest() {
        ServletRequestAttributes attributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attributes != null ? attributes.getRequest() : null;
    }

    private Locale getCurrentLocale() {
        return LocaleContextHolder.getLocale();
    }
}