package ru.igorit.monitoring.admin.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.persistence.entity.admin.Organization;

public interface OrganizationRepository extends JpaRepository<Organization, String> {
}