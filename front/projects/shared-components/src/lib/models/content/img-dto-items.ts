export interface ImgAgentTypeDto {
    value: string;
    name: string;
    description: string;
}

export interface ImgAgentConfigDto {
    id: string;
    agentType: string;
}

export interface ImgAgentListDto {
    id: string;
    organizationId?: string;
    agentType: string;
    name: string;
    description?: string;
    configured?: boolean;
}

export interface ImgAgentItemDto {
    id: string;
    organizationId?: string;
    agentType: string;
    name: string;
    description?: string;
    configured?: boolean;
    config?: ImgAgentConfigDto;
    places: ImgPlaceListDto[];
}

export interface ImgPlaceListDto {
    id: string;
    name: string;
    internalName: string;
    type: string;
}

export interface ImgPlaceDto {
    id: string;
    type: string;
    name: string;
    internalName: string;
    used: boolean;
    actual: boolean;
    present: boolean;
    deleted: boolean;
}