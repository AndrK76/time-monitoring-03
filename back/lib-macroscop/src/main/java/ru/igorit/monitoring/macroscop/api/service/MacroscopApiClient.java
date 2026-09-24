package ru.igorit.monitoring.macroscop.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

@Component
@Log4j2
public class MacroscopApiClient {

    private final WebClient mainClient;
    private final WebClient imgClient;
    private final ObjectMapper objectMapper;

    public MacroscopApiClient(
            @Qualifier("macroscopWebClient") WebClient mainClient,
            @Qualifier("macroscopImgWebClient") WebClient imgClient,
            @Qualifier("macroscopWebClientObjectMapper") ObjectMapper objectMapper) {
        this.mainClient = mainClient;
        this.imgClient = imgClient;
        this.objectMapper = objectMapper;
    }
}
