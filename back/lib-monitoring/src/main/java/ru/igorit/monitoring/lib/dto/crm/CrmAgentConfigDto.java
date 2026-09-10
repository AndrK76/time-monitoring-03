package ru.igorit.monitoring.lib.dto.crm;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CrmAgentConfigDto {
    private String id;
    private String agentType;
}
