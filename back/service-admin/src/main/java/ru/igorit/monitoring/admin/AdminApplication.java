package ru.igorit.monitoring.admin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

@SpringBootApplication
@EnableMethodSecurity
@ComponentScan(basePackages = {
        "ru.igorit.monitoring.admin",
        "ru.igorit.monitoring.security",
        "ru.igorit.monitoring.web",
        "ru.igorit.monitoring.persistence",
        "ru.igorit.monitoring.common",
        "ru.igorit.monitoring.rabbit",
        "ru.igorit.monitoring.lib",
        "ru.igorit.monitoring.yclients.api",
        "ru.igorit.monitoring.yclients.service.manage",
})
@EntityScan(basePackages = {
        "ru.igorit.monitoring.persistence.entity.admin",
        "ru.igorit.monitoring.lib.persistence.entity.admin",
        "ru.igorit.monitoring.lib.persistence.entity.common",
        "ru.igorit.monitoring.lib.persistence.entity.crm",
        "ru.igorit.monitoring.lib.persistence.entity.yclients",
})
@EnableJpaRepositories({
        "ru.igorit.monitoring.persistence.repository.admin",
        "ru.igorit.monitoring.lib.persistence.repository.admin",
        "ru.igorit.monitoring.lib.persistence.repository.common",
        "ru.igorit.monitoring.lib.persistence.repository.crm",
        "ru.igorit.monitoring.lib.persistence.repository.yclients",
})
public class AdminApplication {
    public static void main(String[] args) {
        SpringApplication.run(AdminApplication.class, args);
    }
}