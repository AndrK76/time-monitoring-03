package ru.igorit.monitoring.monitoring;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication
@ComponentScan(basePackages = {
    "ru.igorit.monitoring.monitoring",
    "ru.igorit.monitoring.security",
    "ru.igorit.monitoring.telegram",
    "ru.igorit.monitoring.web",
    "ru.igorit.monitoring.persistence"
})
@EntityScan(basePackages = {"ru.igorit.monitoring.persistence.entity"})
@EnableJpaRepositories(basePackages = {"ru.igorit.monitoring.persistence.repository"})
public class MonitoringApplication {
    public static void main(String[] args) {
        SpringApplication.run(MonitoringApplication.class, args);
    }
}