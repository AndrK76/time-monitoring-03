package ru.igorit.monitoring.admin.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.persistence.entity.admin.UserOrganization;

public interface UserOrganizationRepository extends JpaRepository<UserOrganization, String> {
    void deleteByOrganizationId(String organizationId);
}