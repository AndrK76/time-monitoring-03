package ru.igorit.monitoring.lib.persistence.repository.macroscop;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopImgPlace;

import java.util.List;

public interface MacroscopImgPlaceRepository extends JpaRepository<MacroscopImgPlace, String> {
    @EntityGraph(attributePaths = "channel")
    List<MacroscopImgPlace> findByAgentId(String agentId);
}