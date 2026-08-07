package ru.igorit.monitoring.persistence.config;

import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.transaction.annotation.EnableTransactionManagement;

@Configuration
//@EnableJpaRepositories(basePackages = "ru.igorit.monitoring.persistence.repository")
@EntityScan(basePackages = "ru.igorit.monitoring.persistence.entity")
@EnableJpaAuditing
@EnableTransactionManagement
public class PersistenceConfig {
}