export interface CrmAgentTypeDto {
    value: string;
    name: string;
    description: string;
}

export interface CrmAgentListDto {
    id: string;
    organizationId?: string;
    agentType: string;
    name: string;
    description?: string;
    configured?: boolean;
}

export interface CrmAgentItemDto {
    id: string;
    organizationId?: string;
    agentType: string;
    name: string;
    description?: string;
    configured?: boolean;
    config?: CrmAgentConfigDto;
    crmOrganization?: CrmOrganizationDto;
    services: CrmServiceDto[];
}

export interface CrmAgentConfigDto {
    id: string;
    agentType: string;
}

export interface CrmOrganizationDto {
    id: string;
    name: string;
}

export interface CrmServiceDto {
    id: string;
    name: string;
}