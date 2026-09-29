import {
    MacroscopAgentConfigDto,
    MacroscopAgentConfigListDto,
    MacroscopArchiveModeDto,
    MacroscopChannelDto,
    MacroscopChannelStreamDto,
    MacroscopCredentialsDto,
    MacroscopEvtAgentConfigDto,
    MacroscopImgAgentConfigDto,
} from '@mon3/sc';
import {
    MacroscopAgentConfigListView,
    MacroscopAgentConfigView,
    MacroscopArchiveModeView,
    MacroscopChannelStreamView,
    MacroscopChannelView,
    MacroscopCredentialsView,
    MacroscopEvtAgentConfigView,
    MacroscopImgAgentConfigView,
} from './macroscop-view.models';

export const macroscopCredentialsDtoToView = (
    dto: MacroscopCredentialsDto | undefined
): MacroscopCredentialsView => {
    if (!dto) return new MacroscopCredentialsView();
    return MacroscopCredentialsView.fromDto(dto);
};

export const macroscopCredentialsViewToDto = (
    view: MacroscopCredentialsView
): MacroscopCredentialsDto => {
    return {
        login: view.login,
        password: view.password,
    };
};


export const macroscopAgentConfigDtoToView = (
    dto: MacroscopAgentConfigDto,
    channels?: MacroscopChannelView[],
): MacroscopAgentConfigView => {
    return new MacroscopAgentConfigView(
        dto.id,
        dto.name,
        dto.serverAddress,
        macroscopCredentialsDtoToView(dto.credentials),
        dto.serverInfo,
        channels,
    );
};

export const macroscopAgentConfigListDtoToView = (
    dto: MacroscopAgentConfigListDto
): MacroscopAgentConfigListView => {
    return new MacroscopAgentConfigListView(
        dto.id,
        dto.name,
    );
};

export const macroscopAgentConfigListDtoToFullView = (
    dto: MacroscopAgentConfigListDto
): MacroscopAgentConfigView => {
    return {
        id: dto.id,
        name: dto.name,
        credentials: {}
    } as MacroscopAgentConfigView
};

export const macroscopAgentConfigViewToListView = (
    item: MacroscopAgentConfigView
): MacroscopAgentConfigListDto => {
    return new MacroscopAgentConfigListView(
        item.id,
        item.name,
    );
};

export const macroscopAgentConfigViewToDto = (
    view: MacroscopAgentConfigView
): MacroscopAgentConfigDto => {
    return {
        id: view.id,
        name: view.name,
        serverAddress: view.serverAddress,
        credentials: macroscopCredentialsViewToDto(view.credentials),
        serverInfo: view.serverInfo,
    };
};

export const macroscopEvtAgentConfigDtoToView = (
    dto: MacroscopEvtAgentConfigDto
): MacroscopEvtAgentConfigView => {
    return {
        config: dto.config ? macroscopAgentConfigDtoToView(dto.config) : undefined,
    } as MacroscopEvtAgentConfigView
};

export const macroscopEvtAgentConfigViewToDto = (
    view: MacroscopEvtAgentConfigView
): MacroscopEvtAgentConfigDto => {
    return {
        config: view.config ? macroscopAgentConfigViewToDto(view.config) : undefined,
    };
};

export const macroscopImgAgentConfigDtoToView = (
    dto: MacroscopImgAgentConfigDto
): MacroscopImgAgentConfigView => {
    return {
        config: dto.config ? macroscopAgentConfigDtoToView(dto.config) : undefined,
    } as MacroscopImgAgentConfigView
};

export const macroscopImgAgentConfigViewToDto = (
    view: MacroscopImgAgentConfigView
): MacroscopImgAgentConfigDto => {
    return {
        config: view.config ? macroscopAgentConfigViewToDto(view.config) : undefined,
    };
};

export const createEmptyMacroscopAgentConfigView = (): MacroscopAgentConfigView => {
    return {
        id: 'temp-' + Date.now(),
        name: 'Новая конфигурация сервера',
        serverAddress: 'http://localhost',
        credentials: { login: '', password: '' },
        channels: [],
    } as MacroscopAgentConfigView;
};

export const macroscopChannelDtoToView = (
    dto: MacroscopChannelDto,
    modes: MacroscopArchiveModeView[] | undefined = undefined
): MacroscopChannelView => {
    return new MacroscopChannelView(
        dto.macroscopId,
        dto.enabled,
        dto.exists,
        dto.used,
        dto.archivingEnabled,
        dto.archiveAllowed,
        dto.realtimeAllowed,
        dto.soundAllowed,
        dto.id,
        dto.name,
        dto.device,
        dto.archiveMode,
        macroscopArchiveModeFromId(dto.archiveMode, modes),
        dto.tz,
        (dto.streams ?? []).map(s => macroscopChannelStreamDtoToView(s)),
    );
};

export const macroscopChannelViewToDto = (
    view: MacroscopChannelView
): MacroscopChannelDto => {
    return {
        id: view.id,
        macroscopId: view.macroscopId,
        name: view.name,
        device: view.device,
        enabled: view.enabled,
        exists: view.exists,
        used: view.used,
        archivingEnabled: view.archivingEnabled,
        archiveAllowed: view.archiveAllowed,
        realtimeAllowed: view.realtimeAllowed,
        soundAllowed: view.soundAllowed,
        archiveMode: view.archiveMode,
        tz: view.tz,
        streams: (view.streams ?? []).map(s => macroscopChannelStreamViewToDto(s)),
    };
};

export const macroscopArchiveModeFromId = (
    id: string | undefined,
    allModes: MacroscopArchiveModeView[] | undefined
): MacroscopArchiveModeView | undefined => {
    if (id === undefined || !allModes) return undefined;
    return allModes.find(m => m.id === id);
};

export const macroscopChannelArraysEqual = (
    a: MacroscopChannelView[] | undefined,
    b: MacroscopChannelView[] | undefined,
): boolean => {
    const a1 = a ?? [];
    const b1 = b ?? [];
    if (a1.length !== b1.length) return false;
    return a1.every((v, i) =>
        v.macroscopId === b1[i].macroscopId && v.used === b1[i].used);
};

export const macroscopArchiveModeDtoToView = (
    dto: MacroscopArchiveModeDto
): MacroscopArchiveModeView => {
    return new MacroscopArchiveModeView(dto.id, dto.name);
};

export const macroscopChannelStreamDtoToView = (
    dto: MacroscopChannelStreamDto
): MacroscopChannelStreamView => {
    return new MacroscopChannelStreamView(dto.type, dto.format);
};

export const macroscopChannelStreamViewToDto = (
    view: MacroscopChannelStreamView
): MacroscopChannelStreamDto => {
    return {
        type: view.type,
        format: view.format,
    };
};