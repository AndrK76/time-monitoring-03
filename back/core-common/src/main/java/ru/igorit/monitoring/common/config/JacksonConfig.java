package ru.igorit.monitoring.common.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

//@Configuration
public class JacksonConfig {

    @Bean
    @Primary
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();

        // Регистрируем модуль для поддержки Java 8 Time (LocalDateTime, LocalDate и т.д.)
        mapper.registerModule(new JavaTimeModule());

        // Отключаем запись дат как timestamps
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        // Не падать при неизвестных свойствах
        mapper.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

        // Не падать при пустых бинах
        mapper.disable(SerializationFeature.FAIL_ON_EMPTY_BEANS);

        // Включаем красивый вывод (для отладки)
        // mapper.enable(SerializationFeature.INDENT_OUTPUT);

        return mapper;
    }
}