package ru.igorit.monitoring.auth.helper;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Locale;

@Component
public class LocaleHelper {

    public Locale getCurrentLocale() {
        HttpServletRequest request = getCurrentRequest();
        if (request == null) {
            return Locale.forLanguageTag("en");
        }
        String customLang = request.getHeader("Accept-Language");
        if (customLang != null && !customLang.isEmpty()) {
            return Locale.forLanguageTag(customLang);
        }
        return request.getLocale();
    }

    private HttpServletRequest getCurrentRequest() {
        ServletRequestAttributes attributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attributes != null ? attributes.getRequest() : null;
    }
}