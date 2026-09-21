package ru.igorit.monitoring.lib.persistence.repository.evt;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.crm.EvtAgentListProjection;
import ru.igorit.monitoring.lib.persistence.entity.evt.EvtAgent;

import java.util.List;

public interface EvtAgentRepository extends JpaRepository<EvtAgent, String> {
    List<EvtAgent> findByOrganizationId(String organizationId);

    List<EvtAgentListProjection> findAllProjectedBy();

    List<EvtAgentListProjection> findProjectedByOrganizationId(String organizationId);
}