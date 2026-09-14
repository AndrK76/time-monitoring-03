package ru.igorit.monitoring.yclients.api.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "yclients.config.api")
public class YClientsApiProperties {
    private String apiUrl;
    private String authApi;
    private String companiesApi;
    private String companyApi;
    private String serviceCategoriesApi;
    private int connectTimeout = 15000;
    private int responseTimeout = 15000;
    private int maxMemorySizeMb = 1;
}