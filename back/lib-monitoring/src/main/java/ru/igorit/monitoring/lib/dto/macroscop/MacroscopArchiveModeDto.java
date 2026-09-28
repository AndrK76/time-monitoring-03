package ru.igorit.monitoring.lib.dto.macroscop;

import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopArchiveMode;

public record MacroscopArchiveModeDto(String id, String name) {

    public MacroscopArchiveModeDto(MacroscopArchiveMode val ) {
        this(val.name(), val.getDescription());
    }
}
