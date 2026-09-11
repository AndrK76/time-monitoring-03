package ru.igorit.monitoring.lib.persistence.repository.yclients;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsOrganization;

import java.util.Optional;

public interface YClientsOrganizationRepository extends JpaRepository<YClientsOrganization, String> {
    Optional<YClientsOrganization> findByAgentId(String id);
}