package ru.igorit.monitoring.security.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "cookie")
public class CookieProperties {
    private String domain;
    private boolean secure = false;
    //private boolean httpOnly = true;
    //private int maxAge = 86400;
    //private String path = "/";
    //private String name = "auth_token";
}