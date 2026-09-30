package ru.igorit.monitoring.lib.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.Arrays;

@Getter
@RequiredArgsConstructor
public enum ImgAgentType {
    Macroscop("Macroscop", "Macroscop API", "MACROSCOP");

    private final String name;

    private final String description;

    private final String discriminator;

    public static ImgAgentType byId(String id) {
        if (id == null) return null;
        return Arrays.stream(ImgAgentType.values())
                .filter(f -> id.equalsIgnoreCase(f.name()))
                .findFirst().orElse(null);
    }

    public static ImgAgentType byDiscriminator(String discriminator) {
        if (discriminator == null) return null;
        return Arrays.stream(ImgAgentType.values())
                .filter(f -> discriminator.equalsIgnoreCase(f.getDiscriminator()))
                .findFirst().orElse(null);
    }


}
