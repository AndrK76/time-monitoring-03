// service-admin/src/main/java/ru/igorit/monitoring/admin/AdminApplication.java
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
        "ru.igorit.monitoring.rabbit"
})
@EntityScan(basePackages = {"ru.igorit.monitoring.persistence.entity"})
@EnableJpaRepositories(basePackages = {"ru.igorit.monitoring.persistence.repository"})
public class AdminApplication {
    public static void main(String[] args) {
        SpringApplication.run(AdminApplication.class, args);
    }
}