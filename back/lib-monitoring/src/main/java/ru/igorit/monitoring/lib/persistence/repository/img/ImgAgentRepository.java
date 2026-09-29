package ru.igorit.monitoring.lib.persistence.repository.img;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.img.ImgAgent;
import ru.igorit.monitoring.lib.persistence.entity.img.ImgAgentListProjection;

import java.util.List;

public interface ImgAgentRepository extends JpaRepository<ImgAgent, String> {
    List<ImgAgent> findByOrganizationId(String organizationId);

    List<ImgAgentListProjection> findAllProjectedBy();

    List<ImgAgentListProjection> findProjectedByOrganizationId(String organizationId);
}