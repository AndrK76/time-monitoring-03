package ru.igorit.monitoring.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.persistence.entity.auth.AuthOrganization;

public interface AuthOrganizationRepository extends JpaRepository<AuthOrganization, String> {
}