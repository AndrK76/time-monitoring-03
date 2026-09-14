package ru.igorit.monitoring.lib.persistence.repository.yclients;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsServiceCategory;

import java.util.List;

public interface YClientsServiceCategoryRepository extends JpaRepository<YClientsServiceCategory, Long> {
    List<YClientsServiceCategory> findByAgentId(String agentId);
}