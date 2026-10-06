package ru.igorit.monitoring.lib.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.Arrays;

@Getter
@RequiredArgsConstructor
public enum EvtAgentType {
    Macroscop("Macroscop", "Macroscop API","MACROSCOP"),
    Zigbee("ZigbeeDevice", "Zigbee Devices Service", "ZIGBEE")
    ;

    private final String name;

    private final String description;

    private final String discriminator;

    public static EvtAgentType byId(String id) {
        if (id == null) return null;
        return Arrays.stream(EvtAgentType.values())
                .filter(f -> id.equalsIgnoreCase(f.name()))
                .findFirst().orElse(null);
    }

    public static EvtAgentType byDiscriminator(String discriminator) {
        if (discriminator == null) return null;
        return Arrays.stream(EvtAgentType.values())
                .filter(f -> discriminator.equalsIgnoreCase(f.getDiscriminator()))
                .findFirst().orElse(null);
    }


}
