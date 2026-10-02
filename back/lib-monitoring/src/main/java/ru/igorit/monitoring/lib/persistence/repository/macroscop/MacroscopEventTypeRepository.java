package ru.igorit.monitoring.lib.persistence.repository.macroscop;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopEventType;

public interface MacroscopEventTypeRepository extends JpaRepository<MacroscopEventType, String> {
}