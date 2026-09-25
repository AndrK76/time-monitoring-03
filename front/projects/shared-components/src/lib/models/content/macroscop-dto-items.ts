export interface MacroscopCredentialsDto {
    login?: string;
    password?: string;
}

export interface MacroscopAgentConfigDto {
    id: string;
    name: string;
    serverAddress?: string;
    credentials: MacroscopCredentialsDto;
    serverInfo?: MacroscopServerInfoDto;
}

export interface MacroscopAgentConfigListDto {
    id: string;
    name: string;
}

export interface MacroscopEvtAgentConfigDto {
    config?: MacroscopAgentConfigDto;
}

export interface MacroscopServerCredentials {
    address: string;
    login: string;
    password: string;
}

export interface MacroscopDataResponse<T = unknown> {
    statusCode?: number;
    success?: boolean;
    errorMessage?: string;
    data?: T;
}

export interface MacroscopServerInfoDto {
    id?: string;
    version?: string;
    responseDate?: string;
    tz?: string;
    useTz?: boolean;
}

