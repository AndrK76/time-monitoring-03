package ru.igorit.monitoring.lib.persistence.repository.evt;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.evt.EvtAgentConfig;

public interface EvtAgentConfigRepository extends JpaRepository<EvtAgentConfig, String> {
}