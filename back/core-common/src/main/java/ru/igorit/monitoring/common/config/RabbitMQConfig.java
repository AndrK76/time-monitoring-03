package ru.igorit.monitoring.common.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    @Value("${spring.rabbitmq.host:localhost}")
    private String host;

    @Value("${spring.rabbitmq.port:5672}")
    private int port;

    @Value("${spring.rabbitmq.username:monitoring_service}")
    private String username;

    @Value("${spring.rabbitmq.password:monitoring_password}")
    private String password;

    @Value("${spring.rabbitmq.virtual-host:/}")
    private String virtualHost;

    // Очереди
    public static final String MONITORING_COMMAND_QUEUE = "command.monitoring";
    public static final String ADMIN_COMMAND_QUEUE = "command.admin";
    public static final String MONITORING_RESPONSE_QUEUE = "command.response.monitoring";
    public static final String ADMIN_RESPONSE_QUEUE = "command.response.admin";

    // Экзчейнджи
    public static final String MONITORING_EXCHANGE = "monitoring.exchange";
    public static final String ADMIN_EXCHANGE = "admin.exchange";

    // Routing keys
    public static final String MONITORING_ROUTING_KEY = "monitoring.command";
    public static final String ADMIN_ROUTING_KEY = "admin.command";

    @Bean
    public ConnectionFactory connectionFactory() {
        CachingConnectionFactory connectionFactory = new CachingConnectionFactory(host, port);
        connectionFactory.setUsername(username);
        connectionFactory.setPassword(password);
        connectionFactory.setVirtualHost(virtualHost);
        connectionFactory.setConnectionTimeout(30000);
        connectionFactory.setChannelCacheSize(10);
        return connectionFactory;
    }

    @Bean
    public Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
                                         Jackson2JsonMessageConverter messageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter);
        template.setMandatory(true);
        template.setReplyTimeout(30000);
        return template;
    }

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory,
            Jackson2JsonMessageConverter messageConverter) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(messageConverter);
        factory.setConcurrentConsumers(2);
        factory.setMaxConcurrentConsumers(5);
        factory.setPrefetchCount(1);
        factory.setDefaultRequeueRejected(false);
        return factory;
    }

    // Очереди для мониторинг сервиса
    @Bean
    public Queue monitoringCommandQueue() {
        return QueueBuilder.durable(MONITORING_COMMAND_QUEUE)
                .withArgument("x-message-ttl", 60000)
                .build();
    }

    @Bean
    public Queue monitoringResponseQueue() {
        return QueueBuilder.durable(MONITORING_RESPONSE_QUEUE)
                .withArgument("x-message-ttl", 60000)
                .build();
    }

    // Очереди для админ сервиса
    @Bean
    public Queue adminCommandQueue() {
        return QueueBuilder.durable(ADMIN_COMMAND_QUEUE)
                .withArgument("x-message-ttl", 60000)
                .build();
    }

    @Bean
    public Queue adminResponseQueue() {
        return QueueBuilder.durable(ADMIN_RESPONSE_QUEUE)
                .withArgument("x-message-ttl", 60000)
                .build();
    }

    // Экзчейнджи
    @Bean
    public DirectExchange monitoringExchange() {
        return new DirectExchange(MONITORING_EXCHANGE, true, false);
    }

    @Bean
    public DirectExchange adminExchange() {
        return new DirectExchange(ADMIN_EXCHANGE, true, false);
    }

    // Биндинги
    @Bean
    public Binding monitoringBinding(Queue monitoringCommandQueue, DirectExchange monitoringExchange) {
        return BindingBuilder
                .bind(monitoringCommandQueue)
                .to(monitoringExchange)
                .with(MONITORING_ROUTING_KEY);
    }

    @Bean
    public Binding adminBinding(Queue adminCommandQueue, DirectExchange adminExchange) {
        return BindingBuilder
                .bind(adminCommandQueue)
                .to(adminExchange)
                .with(ADMIN_ROUTING_KEY);
    }
}