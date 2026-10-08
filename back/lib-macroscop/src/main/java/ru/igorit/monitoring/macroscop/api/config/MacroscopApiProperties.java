package ru.igorit.monitoring.macroscop.api.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "macroscop.config.api")
public class MacroscopApiProperties {
    private String serverConfigApi = "/configex";
    private String siteOperationsApi = "/site";
    private String eventTypesApi = "/archive_event_types";
    private String webApi = "/webapi";
    private String licenseApi = "/license";
    private String api = "/api";
    private String channelsSubApi = "/channels";
    private String archiveEventsApi = "/archive_events";

    private int bigResolutionX = 1280;
    private int connectTimeout = 15000;
    private int responseTimeout = 15000;
    private int maxMemorySizeMb = 1;
    private int maxImgMemorySizeMb = 10;

    private int eventsQueryLimit = 500;
}