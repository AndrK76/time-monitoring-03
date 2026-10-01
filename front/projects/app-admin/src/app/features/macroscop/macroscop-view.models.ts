import {
    MacroscopAgentConfigDto,
    MacroscopAgentConfigListDto,
    MacroscopArchiveModeDto,
    MacroscopChannelDto,
    MacroscopChannelStreamDto,
    MacroscopCredentialsDto,
    MacroscopEvtAgentConfigDto,
    MacroscopImgAgentConfigDto,
    MacroscopImgPlaceDto,
    MacroscopImgPlaceListDto,
    MacroscopServerInfoDto,
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
        public serverInfo?: MacroscopServerInfoDto,
        public channels?: MacroscopChannelView[],
    ) { }
}

export class MacroscopAgentConfigListView implements MacroscopAgentConfigListDto {
    constructor(
        public id: string,
        public name: string,
    ) { }
}

export class MacroscopEvtAgentConfigView implements MacroscopEvtAgentConfigDto {
    constructor(
        public config: MacroscopAgentConfigView | undefined,
    ) { }
}

export class MacroscopImgAgentConfigView implements MacroscopImgAgentConfigDto {
    constructor(
        public config: MacroscopAgentConfigView | undefined,
    ) { }
}

export class MacroscopImgPlaceListView implements MacroscopImgPlaceListDto {
    constructor(
        public id: string,
        public name: string,
        public internalName: string,
        public internalId: string,
        public used: boolean,
        public present: boolean,
        public deleted: boolean,
    ) { }
}

export class MacroscopImgPlaceView implements MacroscopImgPlaceDto {
    constructor(
        public id: string,
        public type: string,
        public name: string,
        public internalName: string,
        public used: boolean,
        public actual: boolean,
        public present: boolean,
        public deleted: boolean,
        public macroscopId: string,
        public channelId: string,
    ) { }
    undeleted?: boolean;
}

export class MacroscopChannelView implements MacroscopChannelDto {
    constructor(
        public macroscopId: string,
        public enabled: boolean,
        public exists: boolean,
        public used: boolean,
        public archivingEnabled: boolean,
        public archiveAllowed: boolean,
        public realtimeAllowed: boolean,
        public soundAllowed: boolean,
        public id?: string,
        public name?: string,
        public device?: string,
        public archiveMode?: string,
        public archiveModeInfo?: MacroscopArchiveModeView,
        public tz?: string,
        public streams?: MacroscopChannelStreamView[],
    ) { }
}

export class MacroscopArchiveModeView implements MacroscopArchiveModeDto {
    constructor(
        public id: string,
        public name: string,
    ) { }
}

export class MacroscopChannelStreamView implements MacroscopChannelStreamDto {
    constructor(
        public type?: string,
        public format?: string,
    ) { }
}

