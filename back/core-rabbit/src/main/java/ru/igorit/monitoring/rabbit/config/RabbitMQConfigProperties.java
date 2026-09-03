package ru.igorit.monitoring.rabbit.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "spring.rabbitmq.app-config")
public class RabbitMQConfigProperties {
    public static final String INTERNAL_EXCHANGE = "mon3.exchange";
    public static final String ADMIN_SERVER_ROUTE = "mon3.admin";
    public static final String AUTH_SERVER_ROUTE = "mon3.auth";

    private String internalExchange = INTERNAL_EXCHANGE;
    private String appServerRoute = ADMIN_SERVER_ROUTE;
    private String authServerRoute = AUTH_SERVER_ROUTE;
    private String queueName;

}