export interface EvtAgentTypeDto {
    value: string;
    name: string;
    description: string;
}

export interface EvtAgentConfigDto {
    id: string;
    agentType: string;
}

export interface EvtAgentListDto {
    id: string;
    organizationId?: string;
    agentType: string;
    name: string;
    description?: string;
    configured?: boolean;
}

export interface EvtAgentItemDto {
    id: string;
    organizationId?: string;
    agentType: string;
    name: string;
    description?: string;
    configured?: boolean;
    config?: EvtAgentConfigDto;
    places: EvtPlaceListDto[];
}

export interface EvtPlaceListDto {
    id: string;
    name: string;
}