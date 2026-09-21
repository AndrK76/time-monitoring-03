package ru.igorit.monitoring.lib.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.Arrays;

@Getter
@RequiredArgsConstructor
public enum ImgAgentType {
    Macroscop("Macroscop", "Macroscop API");

    private final String name;

    private final String description;

    public static ImgAgentType byId(String id) {
        if (id == null) return null;
        return Arrays.stream(ImgAgentType.values())
                .filter(f -> id.equalsIgnoreCase(f.name()))
                .findFirst().orElse(null);
    }


}
