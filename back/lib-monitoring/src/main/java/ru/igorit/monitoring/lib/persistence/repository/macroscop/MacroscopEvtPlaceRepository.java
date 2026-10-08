package ru.igorit.monitoring.lib.persistence.repository.macroscop;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopEvtPlace;

import java.util.Collection;
import java.util.List;

public interface MacroscopEvtPlaceRepository extends JpaRepository<MacroscopEvtPlace, String> {
    @EntityGraph(attributePaths = "channel")
    List<MacroscopEvtPlace> findByAgentId(String agentId);

    List<MacroscopEvtPlace> findByChannelIdIn(Collection<String> channelIds);
}