import { YClientsAgentConfigDto, YClientsOrganizationDto, YClientsServiceCategoryListDto } from "@mon3/sc"
import { YClientsAgentConfigView, YClientsOrganizationView, YClientsServiceCategoryListView } from "./yclients-view.models"

export const yClientsAgentConfigDtoToView = (dto: YClientsAgentConfigDto): YClientsAgentConfigView => {
    return {
        id: dto.id,
        credentials: {
            partnerToken: dto.credentials.partnerToken,
            userToken: dto.credentials.userToken,
        },
    } as YClientsAgentConfigView
}

export const yClientsAgentConfigDtoFromView = (item: YClientsAgentConfigView): YClientsAgentConfigDto => {
    return {
        id: item.id,
        credentials: {
            partnerToken: item.credentials.partnerToken,
            userToken: item.credentials.userToken,
        },
    } as YClientsAgentConfigDto
}

export const yClientsOrganizationDtoToView = (dto: YClientsOrganizationDto, selectedId: number | undefined = undefined): YClientsOrganizationView => {
    return {
        id: dto.id,
        places: dto.places,
        agentId: dto.agentId,
        ycId: dto.ycId,
        name: dto.name,
        timezone: dto.timezone,
        _selected: selectedId === dto.ycId
    }
}

export const yClientsOrganizationDtoFromView = (item: YClientsOrganizationView): YClientsOrganizationDto => {
    return {
        id: item.id,
        places: item.places,
        agentId: item.agentId,
        ycId: item.ycId,
        name: item.name,
        timezone: item.timezone,
    }
}

export const yClientsOrganizationDtoPopulate = (dto: YClientsOrganizationDto, newInfo: YClientsOrganizationView): YClientsOrganizationDto => {
    return {
        id: dto.id,
        places: dto.places,
        agentId: dto.agentId,
        ycId: newInfo.ycId,
        name: newInfo.name,
        timezone: newInfo.timezone,
    }
}

export const yClientsServiceCategoryDtoToListView = (dto: YClientsServiceCategoryListDto,
    existsNow: boolean, existsCrm: boolean | undefined,): YClientsServiceCategoryListView => {
    return {
        id: dto.id,
        name: dto.name,
        orgId: dto.orgId,
        existsNow: existsNow,
        existsCRM: existsCrm
    }
}

