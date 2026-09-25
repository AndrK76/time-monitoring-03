package ru.igorit.monitoring.macroscop.api.config;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.MapperFeature;
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
public class MacroscopWebClientFactory {

    private final WebClientFactory factory;
    private final MacroscopApiProperties properties;

    @Bean("macroscopWebClientObjectMapper")
    public ObjectMapper internalObjectMapper(Jackson2ObjectMapperBuilder builder) {
        builder.featuresToEnable(MapperFeature.ACCEPT_CASE_INSENSITIVE_PROPERTIES);
        ObjectMapper mapper = builder.build();
        mapper.registerModule(new JavaTimeModule());
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        mapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
        //mapper.enable(MapperFeature.ACCEPT_CASE_INSENSITIVE_PROPERTIES);
        return mapper;
    }

    @Bean("macroscopWebClient")
    public WebClient macroscopWebClient(
            @Qualifier("macroscopWebClientObjectMapper") ObjectMapper objectMapper) {
        return factory.create(
                "",
                properties.getConnectTimeout(),
                properties.getResponseTimeout(),
                properties.getMaxMemorySizeMb() * 1024 * 1024,
                objectMapper
        );
    }

    @Bean("macroscopImgWebClient")
    public WebClient macroscopImgWebClient(
            @Qualifier("macroscopWebClientObjectMapper") ObjectMapper objectMapper) {
        return factory.create(
                "",
                properties.getConnectTimeout(),
                properties.getResponseTimeout(),
                properties.getMaxImgMemorySizeMb() * 1024 * 1024,
                objectMapper
        );
    }
}
