package ru.igorit.monitoring.lib.dto.evt;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvtAgentListDto {
    private String id;
    private String organizationId;
    @NotBlank(message = "agentType is required")
    private String agentType;
    @NotBlank
    private String name;
    private String description;
    private boolean configured;
}
