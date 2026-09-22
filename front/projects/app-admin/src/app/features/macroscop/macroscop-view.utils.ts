import {
    MacroscopAgentConfigDto,
    MacroscopCredentialsDto,
    MacroscopEvtAgentConfigDto,
} from '@mon3/sc';
import {
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
    return new MacroscopEvtAgentConfigView(
        macroscopAgentConfigDtoToView(dto.config),
    );
};

export const macroscopEvtAgentConfigViewToDto = (
    view: MacroscopEvtAgentConfigView
): MacroscopEvtAgentConfigDto => {
    return {
        config: macroscopAgentConfigViewToDto(view.config),
    };
};

export const createEmptyMacroscopAgentConfigView = (): MacroscopAgentConfigView => {
    return new MacroscopAgentConfigView(
        '',
        '',
        undefined,
        new MacroscopCredentialsView(),
    );
};