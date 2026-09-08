package ru.igorit.monitoring.lib.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.Arrays;

@Getter
@RequiredArgsConstructor
public enum CrmAgentType {
    YClients("YClients CRM", "YClients CRM");

    private final String name;

    private final String description;

    public static CrmAgentType byId(String id) {
        if (id == null) return null;
        return Arrays.stream(CrmAgentType.values())
                .filter(f -> id.equalsIgnoreCase(f.name()))
                .findFirst().orElse(null);
    }


}
