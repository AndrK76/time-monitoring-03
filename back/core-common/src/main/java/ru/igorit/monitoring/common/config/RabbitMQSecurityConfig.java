// core-common/src/main/java/ru/igorit/monitoring/common/config/RabbitMQSecurityConfig.java
package ru.igorit.monitoring.common.config;

import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQSecurityConfig {

    @Bean
    public RabbitAdmin rabbitAdmin(ConnectionFactory connectionFactory) {
        RabbitAdmin admin = new RabbitAdmin(connectionFactory);
        admin.setAutoStartup(true);
        return admin;
    }

    // SSL настройки (опционально)
    /*
    @Bean
    public SSLContext sslContext() throws Exception {
        SSLContext sslContext = SSLContext.getInstance("TLSv1.2");
        TrustManagerFactory tmf = TrustManagerFactory.getInstance(
            TrustManagerFactory.getDefaultAlgorithm()
        );
        KeyStore ks = KeyStore.getInstance("JKS");
        // Загрузка хранилища доверенных сертификатов
        // ks.load(new FileInputStream("truststore.jks"), "password".toCharArray());
        tmf.init(ks);
        sslContext.init(null, tmf.getTrustManagers(), null);
        return sslContext;
    }
    */
}