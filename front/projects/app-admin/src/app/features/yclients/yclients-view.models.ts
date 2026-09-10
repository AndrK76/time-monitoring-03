import { YClientCredentialsDto, YClientsAgentConfigDto } from "@mon3/sc";

export class YClientsAgentConfigView implements YClientsAgentConfigDto {
    constructor(
        public id: string,
        public credentials: YClientCredentialsView,

    ) { }
}

export class YClientCredentialsView implements YClientCredentialsDto {
    public apiUrl?: string;
    public partnerToken?: string;
    public userToken?: string;
}