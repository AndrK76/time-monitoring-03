package ru.igorit.monitoring.lib.persistence.repository.yclients;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsService;

import java.util.List;
import java.util.Optional;

public interface YClientsServiceRepository extends JpaRepository<YClientsService, String> {
    List<YClientsService> findByAgentId(String agentId);
    @Query("SELECT s FROM YClientsService s WHERE s.agent.id = :agentId AND s.yClientsId = :ycId")
    Optional<YClientsService> findByAgent_IdAndYClientsId(String agentId, Long ycId);

    @Modifying
    @Query("delete from YClientsService s where s.id = :id")
    int deleteServiceById(@Param("id") String id);
}