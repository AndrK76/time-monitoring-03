package ru.igorit.monitoring.lib.persistence.repository.yclients;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsServiceCategory;

import java.util.List;

public interface YClientsServiceCategoryRepository extends JpaRepository<YClientsServiceCategory, Long> {
    List<YClientsServiceCategory> findByAgentId(String agentId);

    @Modifying
    @Query("delete from YClientsServiceCategory s where s.yClientsId in :ids")
    int deleteServiceCategoriesByIds(@Param("ids") List<Long> ids);
}