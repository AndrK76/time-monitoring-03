package ru.igorit.monitoring.lib.persistence.repository.yclients;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsPlace;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsService;

import java.util.List;
import java.util.Optional;

public interface YClientsPlaceRepository extends JpaRepository<YClientsPlace, String> {
    @Query("SELECT s FROM YClientsPlace s WHERE s.organization.agent.id = :agentId")
    List<YClientsPlace> findByAgentId(String agentId);
    @Query("SELECT s FROM YClientsPlace s WHERE s.organization.agent.id = :agentId AND s.yclientsId = :ycId")
    Optional<YClientsPlace> findByAgent_IdAndYClientsId(String agentId, Long ycId);

    @Modifying
    @Query("delete from YClientsPlace s where s.id = :id")
    int deletePlaceById(@Param("id") String id);
}