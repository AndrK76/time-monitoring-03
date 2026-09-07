package ru.igorit.monitoring.lib.persistence.repository.common;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.common.Organization;

public interface OrganizationRepository extends JpaRepository<Organization, String> {
}