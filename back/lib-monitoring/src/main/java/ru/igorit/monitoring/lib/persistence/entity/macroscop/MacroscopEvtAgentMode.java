package ru.igorit.monitoring.lib.persistence.entity.macroscop;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.Arrays;

@Getter
@RequiredArgsConstructor
public enum MacroscopEvtAgentMode {
    byAnalytic("По аналитике", true, "По аналитике присутствия"),
    byMovingDetector("По движению", true, "По детектору движения"),
    unknown("Не настроен", false, "Тип не выбран");

    private final String name;
    private final Boolean set;
    private final String description;

    public static MacroscopEvtAgentMode byId(String id) {
        if (id == null) return null;
        return Arrays.stream(MacroscopEvtAgentMode.values())
                .filter(f -> id.equalsIgnoreCase(f.name()))
                .findFirst().orElse(null);
    }
}
