import {
    MacroscopAgentConfigDto,
    MacroscopCredentialsDto,
    MacroscopEvtAgentConfigDto,
} from '@mon3/sc';

export class MacroscopCredentialsView implements MacroscopCredentialsDto {
    public login?: string;
    public password?: string;

    static fromDto(dto: MacroscopCredentialsDto): MacroscopCredentialsView {
        const v = new MacroscopCredentialsView();
        v.login = dto.login;
        v.password = dto.password;
        return v;
    }
}

export class MacroscopAgentConfigView implements MacroscopAgentConfigDto {
    constructor(
        public id: string,
        public name: string,
        public serverAddress: string | undefined,
        public credentials: MacroscopCredentialsView,
    ) { }
}

export class MacroscopEvtAgentConfigView implements MacroscopEvtAgentConfigDto {
    constructor(
        public config: MacroscopAgentConfigView,
    ) { }
}