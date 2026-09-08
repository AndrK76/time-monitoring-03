package ru.igorit.monitoring.lib.dto.crm;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CrmAgentItemDto {
    private String id;
    private String organizationId;
    private String agentType;
    private String name;
    private String description;
    private boolean configured;
    private CrmAgentConfigDto config;
    private CrmOrganizationDto crmOrganization;
    private List<CrmServiceDto> services;
}
