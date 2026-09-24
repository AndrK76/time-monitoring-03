package ru.igorit.monitoring.lib.persistence.repository.macroscop;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopEvtAgentConfig;

import java.util.List;

public interface MacroscopEvtAgentConfigRepository extends JpaRepository<MacroscopEvtAgentConfig, String> {
    @EntityGraph(attributePaths = {"agent", "agent.organization"})
    List<MacroscopEvtAgentConfig> findByConfigId(String configId);
}