package ru.igorit.monitoring.lib.persistence.repository.macroscop;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopEvtAgent;

public interface MacroscopEvtAgentRepository extends JpaRepository<MacroscopEvtAgent, String> {
}