package ru.igorit.monitoring.lib.persistence.repository.yclients;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsServiceCategory;

public interface YClientsServiceCategoryRepository extends JpaRepository<YClientsServiceCategory, Long> {
}