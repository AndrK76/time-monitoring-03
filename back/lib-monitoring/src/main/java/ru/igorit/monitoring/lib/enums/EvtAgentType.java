package ru.igorit.monitoring.lib.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.Arrays;

@Getter
@RequiredArgsConstructor
public enum EvtAgentType {
    Macroscop("Macroscop", "Macroscop API"),
    Zigbee("ZigbeeDevice", "Zigbee Devices Service"),;

    private final String name;

    private final String description;

    public static EvtAgentType byId(String id) {
        if (id == null) return null;
        return Arrays.stream(EvtAgentType.values())
                .filter(f -> id.equalsIgnoreCase(f.name()))
                .findFirst().orElse(null);
    }


}
