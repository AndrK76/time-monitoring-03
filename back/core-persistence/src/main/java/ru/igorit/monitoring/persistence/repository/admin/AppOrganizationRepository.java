package ru.igorit.monitoring.persistence.repository.admin;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.persistence.entity.admin.AppOrganization;

public interface AppOrganizationRepository extends JpaRepository<AppOrganization, String> {
}