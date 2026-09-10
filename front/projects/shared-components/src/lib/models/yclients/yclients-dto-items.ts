export interface YClientsAgentConfigDto {
    id: string;
    credentials: YClientCredentialsDto;
}

export interface YClientCredentialsDto {
    apiUrl?: string;
    partnerToken?: string;
    userToken?: string;
}