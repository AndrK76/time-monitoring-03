package ru.igorit.monitoring.lib.persistence.repository.yclients;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsAgent;

public interface YClientsAgentRepository extends JpaRepository<YClientsAgent, String> {
}