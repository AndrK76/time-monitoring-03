package ru.igorit.monitoring.lib.dto.macroscop;

import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopEvtAgentMode;

public record MacroscopEvtAgentModeDto(String id, boolean set, String name, String description) {

    public MacroscopEvtAgentModeDto(MacroscopEvtAgentMode val) {
        this(val.name(), val.getSet() != null && val.getSet(), val.getName(), val.getDescription());
    }
}
