package ru.igorit.monitoring.lib.dto.evt;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvtAgentTypeDto {
    private String value;
    private String name;
    private String description;
}
