package ru.igorit.monitoring.lib.persistence.repository.img;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import ru.igorit.monitoring.lib.persistence.entity.img.ImgPlace;

import java.util.List;

public interface ImgPlaceRepository extends JpaRepository<ImgPlace, String> {

    @Query("""
                SELECT p
                FROM ImgPlace p
                LEFT JOIN FETCH TREAT(p AS MacroscopImgPlace).channel
                WHERE p.agent.id = :agentId
            """)
    List<ImgPlace> findByAgentId(String agentId);
}