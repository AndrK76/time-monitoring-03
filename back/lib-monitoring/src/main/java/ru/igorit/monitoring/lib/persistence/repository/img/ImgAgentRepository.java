package ru.igorit.monitoring.lib.persistence.repository.img;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.igorit.monitoring.lib.persistence.entity.img.ImgAgent;
import ru.igorit.monitoring.lib.persistence.entity.img.ImgAgentListProjection;

import java.util.List;
import java.util.Optional;

public interface ImgAgentRepository extends JpaRepository<ImgAgent, String> {
    List<ImgAgent> findByOrganizationId(String organizationId);

    List<ImgAgentListProjection> findAllProjectedBy();

    List<ImgAgentListProjection> findProjectedByOrganizationId(String organizationId);

    @Query("""
                SELECT DISTINCT a
                FROM ImgAgent a
                LEFT JOIN FETCH a.config
                LEFT JOIN FETCH a.places p
                LEFT JOIN FETCH TREAT(p AS MacroscopImgPlace).channel
                WHERE a.id = :id
            """)
    Optional<ImgAgent> findByIdWithPlaces(@Param("id") String id);
}