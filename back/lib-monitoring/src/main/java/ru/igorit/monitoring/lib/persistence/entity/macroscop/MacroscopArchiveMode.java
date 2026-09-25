package ru.igorit.monitoring.lib.persistence.entity.macroscop;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import ru.igorit.monitoring.lib.enums.EvtAgentType;

import java.util.Arrays;

@Getter
@RequiredArgsConstructor
public enum MacroscopArchiveMode {
    Always("AlwaysOn","Всегда включена"),
    Manual("OnlyManual","Вручную"),
    Schedule("BySchedule","По расписанию"),
    Detector("MDandManual","По детектору движения")
    ;

    private final String macroscopId;
    private final String description;

    public static MacroscopArchiveMode byId(String id) {
        if (id == null) return null;
        return Arrays.stream(MacroscopArchiveMode.values())
                .filter(f -> id.equalsIgnoreCase(f.name()))
                .findFirst().orElse(null);
    }

    public static MacroscopArchiveMode byMacroscopId(String id) {
        if (id == null) return null;
        return Arrays.stream(MacroscopArchiveMode.values())
                .filter(f -> id.equalsIgnoreCase(f.getMacroscopId()))
                .findFirst().orElse(null);
    }

    public static String idByMacroscopId(String id) {
        if (id == null) return null;
        var ret = Arrays.stream(MacroscopArchiveMode.values())
                .filter(f -> id.equalsIgnoreCase(f.getMacroscopId()))
                .findFirst().orElse(null);
        if (ret == null) return null;
        return ret.name();
    }



}
