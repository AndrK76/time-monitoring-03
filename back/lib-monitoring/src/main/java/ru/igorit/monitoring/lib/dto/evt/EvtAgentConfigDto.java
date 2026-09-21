package ru.igorit.monitoring.lib.dto.evt;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvtAgentConfigDto {
    private String id;
    private String agentType;
}
