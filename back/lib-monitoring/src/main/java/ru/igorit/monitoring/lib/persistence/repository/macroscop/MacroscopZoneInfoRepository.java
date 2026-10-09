package ru.igorit.monitoring.lib.persistence.repository.macroscop;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopZoneInfo;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;

public interface MacroscopZoneInfoRepository extends JpaRepository<MacroscopZoneInfo, Long> {
    Optional<MacroscopZoneInfo> findFirstByPlaceIdAndValidToIsNull(String placeId);

    List<MacroscopZoneInfo> findByPlaceIdOrderByValidFromAsc(String placeId);

    @Query("""
        select z from MacroscopZoneInfo z
        where z.place.id = :placeId
          and z.validFrom <= :at
          and (z.validTo is null or z.validTo > :at)
        """)
    Optional<MacroscopZoneInfo> findAt(@Param("placeId") String placeId,
                                       @Param("at") ZonedDateTime at);
}