export interface MacroscopCredentialsDto {
    login?: string;
    password?: string;
}

export interface MacroscopAgentConfigDto {
    id: string;
    name: string;
    serverAddress?: string;
    credentials: MacroscopCredentialsDto;
}

export interface MacroscopAgentConfigListDto {
    id: string;
    name: string;
}

export interface MacroscopEvtAgentConfigDto {
    config?: MacroscopAgentConfigDto;
}

