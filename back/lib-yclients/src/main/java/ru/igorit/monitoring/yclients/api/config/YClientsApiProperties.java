package ru.igorit.monitoring.yclients.api.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Data
@Component
@ConfigurationProperties(prefix = "yclients.config.api")
public class YClientApiProperties {
    private String apiUrl;
    private String authApi;
}