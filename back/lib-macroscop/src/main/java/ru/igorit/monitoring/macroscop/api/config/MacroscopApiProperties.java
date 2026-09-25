package ru.igorit.monitoring.macroscop.api.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "macroscop.config.api")
public class MacroscopApiProperties {
    private String serverConfigApi = "/configex";
    private int connectTimeout = 15000;
    private int responseTimeout = 15000;
    private int maxMemorySizeMb = 1;
    private int maxImgMemorySizeMb = 10;
}