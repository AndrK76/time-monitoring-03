package ru.igorit.monitoring.lib.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrgStructListDto {
    private String id;
    private String shortName;
    private String fullName;
    private boolean crmAgentSet;
    private boolean eventAgentsSet;
    private boolean cameraAgentsSet;
}
