import {
    MacroscopActivityEventTypeDto,
    MacroscopAgentConfigDto,
    MacroscopAgentConfigListDto,
    MacroscopArchiveModeDto,
    MacroscopChannelDto,
    MacroscopChannelListDto,
    MacroscopChannelStreamDto,
    MacroscopCredentialsDto,
    MacroscopEventTypeDto,
    MacroscopEvtActionPlacesResponseDto,
    MacroscopEvtAgentConfigDto,
    MacroscopEvtAgentModeDto,
    MacroscopEvtPlaceDto,
    MacroscopEvtPlaceListDto,
    MacroscopImgAgentConfigDto,
    MacroscopImgPlaceDto,
    MacroscopImgPlaceListDto,
    MacroscopZoneInfoDto,
} from '@mon3/sc';
import {
    MacroscopActivityEventTypeView,
    MacroscopAgentConfigListView,
    MacroscopAgentConfigView,
    MacroscopArchiveModeView,
    MacroscopChannelStreamView,
    MacroscopChannelView,
    MacroscopCredentialsView,
    MacroscopEventTypeView,
    MacroscopEvtAgentConfigView,
    MacroscopEvtAgentModeView,
    MacroscopEvtPlaceListView,
    MacroscopEvtPlaceView,
    MacroscopImgAgentConfigView,
    MacroscopImgPlaceListView,
    MacroscopImgPlaceView,
    MacroscopZoneInfoView,
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
    dto: MacroscopEvtAgentConfigDto, allModes: MacroscopEvtAgentModeView[] | undefined = undefined
): MacroscopEvtAgentConfigView => {
    return {
        config: dto.config ? macroscopAgentConfigDtoToView(dto.config) : undefined,
        mode: dto.mode,
        searchPlaceDepthInHours: dto.searchPlaceDepthInHours ?? 24,
        modeWithInfo: macroscopEvtAgentModeFromId(dto.mode, allModes),
    } as MacroscopEvtAgentConfigView
};

export const macroscopEvtAgentConfigViewToDto = (
    view: MacroscopEvtAgentConfigView
): MacroscopEvtAgentConfigDto => {
    return {
        config: view.config ? macroscopAgentConfigViewToDto(view.config) : undefined,
        mode: view.mode,
        searchPlaceDepthInHours: view.searchPlaceDepthInHours ?? 24,
    };
};

export const macroscopEvtAgentModeFromId = (
    id: string | undefined,
    allModes: MacroscopEvtAgentModeView[] | undefined
): MacroscopEvtAgentModeView | undefined => {
    if (id === undefined || !allModes) return undefined;
    return allModes.find(m => m.id === id);
};

export const macroscopEvtAgentModeDtoToView = (
    dto: MacroscopEvtAgentModeDto
): MacroscopEvtAgentModeView => {
    return new MacroscopEvtAgentModeView(dto.id, dto.set, dto.name, dto.description);
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

export const macroscopImgPlaceListDtoToView = (
    dto: MacroscopImgPlaceListDto
): MacroscopImgPlaceView => {
    return {
        id: dto.id,
        type: 'Macroscop',
        name: dto.name,
        internalName: dto.internalName,
        used: dto.used,
        actual: false,
        present: dto.present,
        deleted: dto.deleted,
        macroscopId: dto.internalId,
        channelId: '',
    } as MacroscopImgPlaceView;
};

export const macroscopImgPlaceDtoToView = (dto: MacroscopImgPlaceDto): MacroscopImgPlaceView => {
    return new MacroscopImgPlaceView(
        dto.id,
        dto.type,
        dto.name,
        dto.internalName,
        dto.used,
        dto.actual,
        dto.present,
        dto.deleted,
        dto.macroscopId,
        dto.channelId,
    );
};


export const macroscopImgPlaceViewToDto = (
    view: MacroscopImgPlaceView
): MacroscopImgPlaceDto => {
    return {
        id: view.id,
        type: view.type,
        name: view.name,
        internalName: view.internalName,
        used: view.used,
        actual: view.actual,
        present: view.present,
        deleted: view.deleted,
        macroscopId: view.macroscopId,
        channelId: view.channelId,
    };
};

export const createNewMacroscopPlace = (): MacroscopImgPlaceView => {
    return {
        id: 'temp-' + Date.now(),
        type: 'Macroscop',
        name: '',
        internalName: '',
        used: true,
        actual: false,
        present: false,
        deleted: false,
        macroscopId: '',
        channelId: '',
    } as MacroscopImgPlaceView;
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

export const macroscopChannelListDtoToView = (
    dto: MacroscopChannelListDto
): MacroscopChannelView => {

    return {
        macroscopId: dto.macroscopId,
        enabled: dto.enabled,
        exists: dto.exists,
        used: dto.used,
        archivingEnabled: true,
        archiveAllowed: true,
        realtimeAllowed: true,
        soundAllowed: true,
        id: dto.id,
        name: dto.name,
        device: dto.device,

    } as MacroscopChannelView;
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

export const macroscopActivityEventTypeDtoToView = (dto: MacroscopActivityEventTypeDto): MacroscopActivityEventTypeView => {
    return new MacroscopActivityEventTypeView(dto.id, dto.description);
};

export const macroscopActivityEventTypeFromId = (
    id: string | undefined, all: MacroscopActivityEventTypeView[] | undefined,): MacroscopActivityEventTypeView | undefined => {
    if (!id || !all) return undefined;
    return all.find(a => a.id === id);
};

export const macroscopEventTypeDtoToView = (dto: MacroscopEventTypeDto, types: MacroscopActivityEventTypeView[] | undefined = undefined,
): MacroscopEventTypeView => {
    return new MacroscopEventTypeView(
        dto.id,
        dto.name,
        dto.activityTypeId,
        macroscopActivityEventTypeFromId(dto.activityTypeId, types),
    );
};

export const macroscopEventTypeViewToDto = (view: MacroscopEventTypeView): MacroscopEventTypeDto => {
    return {
        id: view.id,
        name: view.name,
        activityTypeId: view.activityTypeId,
    };
};


export const macroscopZoneInfoDtoToView = (dto: MacroscopZoneInfoDto | undefined): MacroscopZoneInfoView | undefined => {
    if (!dto) return undefined;
    return new MacroscopZoneInfoView(dto.left, dto.top, dto.width, dto.height);
};

export const macroscopZoneInfoViewToDto = (view: MacroscopZoneInfoView | undefined): MacroscopZoneInfoDto | undefined => {
    if (!view) return undefined;
    return {
        left: view.left,
        top: view.top,
        width: view.width,
        height: view.height,
    };
};

export const macroscopChannelFromId = (
    id: string | undefined,
    allChannels: MacroscopChannelView[] | undefined
): MacroscopChannelView | undefined => {
    if (id === undefined || !allChannels) return undefined;
    return allChannels.find(m => m.id === id);
};

export const macroscopEvtPlaceListDtoToView = (dto: MacroscopEvtPlaceListDto,
    channels?: MacroscopChannelView[],
): MacroscopEvtPlaceView => {
    return {
        id: dto.id,
        type: 'Macroscop',
        name: dto.name,
        internalName: dto.internalName,
        internalId: dto.internalId,
        channelId: dto.channelId,
        channelName: macroscopChannelFromId(dto?.channelId, channels)?.name,
        zoneInfo: undefined,
        used: dto.used,
        actual: false,
        present: dto.present,
        deleted: dto.deleted,
        evtMode: dto.evtMode,
    } as MacroscopEvtPlaceView;
};

export const macroscopEvtPlaceDtoToView = (dto: MacroscopEvtPlaceDto,
    channels?: MacroscopChannelView[],): MacroscopEvtPlaceView => {
    return {
        id: dto.id,
        type: dto.type,
        name: dto.name,
        channelId: dto.channelId,
        channelName: macroscopChannelFromId(dto?.channelId, channels)?.name,
        internalName: dto.internalName,
        internalId: dto.internalId,
        zoneInfo: macroscopZoneInfoDtoToView(dto.zoneInfo),
        used: dto.used,
        actual: dto.actual,
        present: dto.present,
        deleted: dto.deleted,
        evtMode: dto.evtMode,
    } as MacroscopEvtPlaceView;
};

export const macroscopEvtPlaceViewToDto = (
    view: MacroscopEvtPlaceView
): MacroscopEvtPlaceDto => {
    return {
        id: view.id,
        type: view.type,
        name: view.name,
        internalName: view.internalName,
        internalId: view.internalId,
        channelId: view.channelId,
        zoneInfo: macroscopZoneInfoViewToDto(view.zoneInfo),
        used: view.used,
        actual: view.actual,
        present: view.present,
        deleted: view.deleted,
        evtMode: view.evtMode,
    };
};



