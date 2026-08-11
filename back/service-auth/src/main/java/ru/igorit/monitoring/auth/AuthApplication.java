package ru.igorit.monitoring.auth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

@SpringBootApplication
@EnableMethodSecurity
//@EnableRedisRepositories
@ComponentScan(basePackages = {
        "ru.igorit.monitoring.auth",
        "ru.igorit.monitoring.security",
        "ru.igorit.monitoring.telegram",
        "ru.igorit.monitoring.web",
        "ru.igorit.monitoring.persistence",
        "ru.igorit.monitoring.common",
        "ru.igorit.monitoring.rabbit"
})
@EntityScan(basePackages = {"ru.igorit.monitoring.persistence.entity"})
@EnableJpaRepositories(basePackages = {"ru.igorit.monitoring.persistence.repository"})
public class AuthApplication {
    public static void main(String[] args) {
        SpringApplication.run(AuthApplication.class, args);
    }
}
