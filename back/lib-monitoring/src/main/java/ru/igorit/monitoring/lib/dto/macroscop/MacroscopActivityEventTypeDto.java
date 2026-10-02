package ru.igorit.monitoring.lib.dto.macroscop;

import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopActivityEventType;

public record MacroscopActivityEventTypeDto(String id, String description) {
    public MacroscopActivityEventTypeDto(MacroscopActivityEventType val) {
        this(val.name(), val.getDescription());
    }

}
