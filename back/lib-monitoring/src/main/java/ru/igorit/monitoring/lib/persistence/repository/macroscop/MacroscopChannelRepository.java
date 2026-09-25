package ru.igorit.monitoring.lib.persistence.repository.macroscop;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopChannel;

import java.util.List;

public interface MacroscopChannelRepository extends JpaRepository<MacroscopChannel, String> {
    List<MacroscopChannel> findByConfigId(String configId);
}