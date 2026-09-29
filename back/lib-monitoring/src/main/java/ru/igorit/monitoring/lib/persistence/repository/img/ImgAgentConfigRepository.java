package ru.igorit.monitoring.lib.persistence.repository.img;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.img.ImgAgentConfig;

public interface ImgAgentConfigRepository extends JpaRepository<ImgAgentConfig, String> {
}