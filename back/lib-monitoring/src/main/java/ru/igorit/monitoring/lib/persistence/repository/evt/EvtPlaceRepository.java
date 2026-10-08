package ru.igorit.monitoring.lib.persistence.repository.evt;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import ru.igorit.monitoring.lib.persistence.entity.evt.EvtPlace;

import java.util.List;

public interface EvtPlaceRepository extends JpaRepository<EvtPlace, String> {
    @Query("""
                SELECT p
                FROM EvtPlace p
                LEFT JOIN FETCH TREAT(p AS MacroscopEvtPlace).channel
                WHERE p.agent.id = :agentId
            """)
    List<EvtPlace> findByAgentId(String agentId);
}