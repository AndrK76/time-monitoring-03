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

export interface MacroscopImgAgentConfigDto {
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

export interface MacroscopChannelDto {
    id?: string;
    macroscopId: string;
    name?: string;
    device?: string;
    enabled: boolean;
    exists: boolean;
    used: boolean;
    archivingEnabled: boolean;
    archiveAllowed: boolean;
    realtimeAllowed: boolean;
    soundAllowed: boolean;
    archiveMode?: string;
    tz?: string;
    streams?: MacroscopChannelStreamDto[];
}

export interface MacroscopArchiveModeDto {
    id: string;
    name: string;
}

export interface MacroscopChannelStreamDto {
    type?: string;
    format?: string;
}