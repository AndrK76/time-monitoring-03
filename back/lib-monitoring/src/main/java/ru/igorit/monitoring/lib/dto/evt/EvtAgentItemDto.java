package ru.igorit.monitoring.lib.dto.evt;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvtAgentItemDto {
    private String id;
    private String organizationId;
    private String agentType;
    private String name;
    private String description;
    private boolean configured;
    private EvtAgentConfigDto config;
    private List<EvtPlaceListDto> places;
}
