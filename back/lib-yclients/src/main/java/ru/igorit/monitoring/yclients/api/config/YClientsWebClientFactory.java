package ru.igorit.monitoring.yclients.api.config;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.web.reactive.function.client.WebClient;
import ru.igorit.monitoring.web.utils.WebClientFactory;

@Configuration
@RequiredArgsConstructor
public class YClientsWebClientFactory {

    private final WebClientFactory factory;
    private final YClientsApiProperties properties;

    @Bean("yclientsWebClientObjectMapper")
    public ObjectMapper internalObjectMapper(Jackson2ObjectMapperBuilder builder) {
        ObjectMapper mapper = builder.build();
        mapper.registerModule(new JavaTimeModule());
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        mapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
        return mapper;
    }

    @Bean("yclientsWebClient")
    public WebClient internalWebClient(
            @Qualifier("yclientsWebClientObjectMapper") ObjectMapper objectMapper) {
        return factory.create(
                properties.getApiUrl(),
                properties.getConnectTimeout(),
                properties.getResponseTimeout(),
                properties.getMaxMemorySizeMb() * 1024 * 1024,
                objectMapper
        );
    }
}
