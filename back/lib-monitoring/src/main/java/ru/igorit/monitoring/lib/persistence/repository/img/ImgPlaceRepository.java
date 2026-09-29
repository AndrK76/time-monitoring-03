package ru.igorit.monitoring.lib.persistence.repository.img;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.img.ImgPlace;

public interface ImgPlaceRepository extends JpaRepository<ImgPlace, String> {
}