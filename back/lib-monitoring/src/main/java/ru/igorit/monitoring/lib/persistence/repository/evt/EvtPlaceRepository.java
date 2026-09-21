package ru.igorit.monitoring.lib.persistence.repository.evt;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.evt.EvtPlace;

public interface EvtPlaceRepository extends JpaRepository<EvtPlace, String> {
}