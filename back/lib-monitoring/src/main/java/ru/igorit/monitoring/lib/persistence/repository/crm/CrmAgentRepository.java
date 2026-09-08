package ru.igorit.monitoring.lib.persistence.repository.crm;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.crm.CrmAgent;
import ru.igorit.monitoring.lib.persistence.entity.crm.CrmAgentListProjection;

import java.util.List;

public interface CrmAgentRepository extends JpaRepository<CrmAgent, String> {
    List<CrmAgent> findByOrganizationId(String organizationId);

    List<CrmAgentListProjection> findAllProjectedBy();

    List<CrmAgentListProjection> findProjectedByOrganizationId(String organizationId);
}