package ru.igorit.monitoring.lib.persistence.repository.macroscop;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopImgAgentConfig;

import java.util.List;

public interface MacroscopImgAgentConfigRepository extends JpaRepository<MacroscopImgAgentConfig, String> {
    @EntityGraph(attributePaths = {"agent", "agent.organization"})
    List<MacroscopImgAgentConfig> findByConfigId(String configId);
}
