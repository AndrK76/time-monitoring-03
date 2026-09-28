package ru.igorit.monitoring.lib.persistence.repository.macroscop;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopChannel;

import java.util.List;
import java.util.Optional;

public interface MacroscopChannelRepository extends JpaRepository<MacroscopChannel, String> {
    @EntityGraph(attributePaths = "streams")
    List<MacroscopChannel> findByConfigId(String configId);

    @EntityGraph(attributePaths = "streams")
    Optional<MacroscopChannel> findByConfigIdAndMacroscopId(String configId, String macroscopId);
}