package ru.igorit.monitoring.monitoring;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

@SpringBootApplication
@EnableMethodSecurity
@ComponentScan(basePackages = {
        "ru.igorit.monitoring.monitoring",
        "ru.igorit.monitoring.security",
        "ru.igorit.monitoring.web",
        "ru.igorit.monitoring.common",
        "ru.igorit.monitoring.rabbit",
        "ru.igorit.monitoring.lib"
})
@EntityScan(basePackages = {"ru.igorit.monitoring.lib.persistence.entity.common"})
@EnableJpaRepositories({
        "ru.igorit.monitoring.lib.persistence.repository.common"
})
public class MonitoringApplication {
    public static void main(String[] args) {
        SpringApplication.run(MonitoringApplication.class, args);
    }
}