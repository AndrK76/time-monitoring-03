import {
    MacroscopAgentConfigDto,
    MacroscopAgentConfigListDto,
    MacroscopCredentialsDto,
    MacroscopEvtAgentConfigDto,
} from '@mon3/sc';
import {
    MacroscopAgentConfigListView,
    MacroscopAgentConfigView,
    MacroscopCredentialsView,
    MacroscopEvtAgentConfigView,
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
    dto: MacroscopAgentConfigDto
): MacroscopAgentConfigView => {
    return new MacroscopAgentConfigView(
        dto.id,
        dto.name,
        dto.serverAddress,
        macroscopCredentialsDtoToView(dto.credentials),
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

export const createEmptyMacroscopAgentConfigView = (): MacroscopAgentConfigView => {
    return {
        id: 'temp-' + Date.now(),
        name: 'Новая конфигурация сервера',
        serverAddress: 'http://localhost',
        credentials: {
            login: '',
            password: ''
        }
    } as MacroscopAgentConfigView;

};