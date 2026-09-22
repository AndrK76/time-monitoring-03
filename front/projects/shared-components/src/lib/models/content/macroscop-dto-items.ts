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

export interface MacroscopEvtAgentConfigDto {
    config: MacroscopAgentConfigDto;
}