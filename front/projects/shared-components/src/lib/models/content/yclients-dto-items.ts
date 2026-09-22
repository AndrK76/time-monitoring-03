export interface YClientsAgentConfigDto {
    id: string;
    credentials: YClientCredentialsDto;
}

export interface YClientCredentialsDto {
    partnerToken?: string;
    userToken?: string;
}

export interface YClientsTokenRequestDto {
    partnerToken: string;
    login: string;
    password: string;
}

export interface YClientsTokenResponseDto {
    statusCode?: number;
    statusMessage?: string;
    success?: boolean;
    errorMessage?: string;
    userToken?: string;
}

export interface YClientsOrganizationDto {
    id: string;
    places?: string[];
    agentId: string;
    ycId?: number;
    name?: string;
    timezone?: string;
}

export interface YClientsServiceCategoryDto {
    id: number;
    name: string;
    orgId: number;
}

export interface YClientsDataResponseDto<T = unknown> {
    statusCode?: number;
    statusMessage?: string;
    success?: boolean;
    errorMessage?: string;
    data?: T;
    meta?: Record<string, string>;
}

export interface YClientsServiceDto {
    id?: string;
    name?: string;
    ycId: number;
    ycName: string;
    categoryId: number;
}

export interface YClientsPlaceDto {
    id?: string;
    name?: string;
    ycId: number;
    ycName: string;
    available: boolean;
}

