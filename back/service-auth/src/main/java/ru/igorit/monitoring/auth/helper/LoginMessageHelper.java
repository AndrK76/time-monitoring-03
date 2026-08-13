package ru.igorit.monitoring.auth.helper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
@RequiredArgsConstructor
@Slf4j
public class LoginMessageHelper {

    private final MessageSource messageSource;

    /**
     * Получение локализованного сообщения для исключения
     */
    public String getLocalizedMessage(Exception e) {
        Locale locale = LocaleContextHolder.getLocale();
        String code = getMessageCode(e);

        try {
            return messageSource.getMessage(code, null, locale);
        } catch (Exception ex) {
            // Если сообщение не найдено — возвращаем сообщение из исключения или дефолтное
            return e.getMessage() != null ? e.getMessage() : "Auth error";
        }
    }

    private String getMessageCode(Exception e) {
        if (e instanceof LockedException) {
            return "AbstractUserDetailsAuthenticationProvider.locked";
        }
        if (e instanceof BadCredentialsException) {
            return "DaoAuthenticationProvider.badCredentials";
        }
        if (e instanceof UsernameNotFoundException) {
            return "AbstractUserDetailsAuthenticationProvider.USERNAME_NOT_FOUND";
        }
        if (e instanceof AuthenticationException) {
            return "AbstractUserDetailsAuthenticationProvider.badCredentials";
        }
        return "AbstractUserDetailsAuthenticationProvider.badCredentials";
    }
}