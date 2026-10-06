package ru.igorit.monitoring.lib.persistence.entity.macroscop;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.Arrays;

@Getter
@RequiredArgsConstructor
public enum MacroscopActivityEventType {
    ActiveZone("Активная зона (по аналитике)", true),
    InactiveZone("Неактивная зона (по аналитике)", true),
    StartMotion("Начало движения (по датчику движения)", false),
    EndMotion("Окончание движения (по датчику движения)", false);

    private final String description;
    private final boolean analytic;

    public static MacroscopActivityEventType byId(String id) {
        if (id == null) return null;
        return Arrays.stream(MacroscopActivityEventType.values())
                .filter(f -> id.equalsIgnoreCase(f.name()))
                .findFirst().orElse(null);
    }
}
