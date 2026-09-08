package ru.igorit.monitoring.lib.persistence.repository.crm;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.crm.CrmPlace;

public interface CrmPlaceRepository extends JpaRepository<CrmPlace, String> {
}