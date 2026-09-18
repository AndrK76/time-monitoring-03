import { YClientsAgentConfigDto, YClientsOrganizationDto, YClientsPlaceDto, YClientsServiceCategoryDto, YClientsServiceDto } from "@mon3/sc"
import { YClientsAgentConfigView, YClientsOrganizationView, YClientsPlaceView, YClientsServiceCategoryView, YClientsServiceView } from "./yclients-view.models"

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

export const yClientsServiceCategoryDtoToView = (dto: YClientsServiceCategoryDto,
    existsNow: boolean, existsCrm: boolean | undefined, selected: boolean): YClientsServiceCategoryView => {
    return {
        id: dto.id,
        name: dto.name,
        orgId: dto.orgId,
        existsNow: existsNow,
        existsCRM: existsCrm,
        selected: selected,
    }
}

export const yClientsServiceCategoryFromView = (item: YClientsServiceCategoryView): YClientsServiceCategoryDto => {
    return {
        id: item.id,
        name: item.name,
        orgId: item.orgId,
    }
}


export const yClientsServiceCategoryFromId = (
    categoryId: number | undefined,
    allCategories: YClientsServiceCategoryView[] | undefined
): YClientsServiceCategoryView | undefined => {
    if (categoryId === undefined || !allCategories) return undefined;
    return allCategories.find(c => c.id === categoryId);
};

export const yClientsServiceDtoToView = (
    dto: YClientsServiceDto,
    categories: YClientsServiceCategoryView[] | undefined = undefined
): YClientsServiceView => {
    return {
        id: dto.id,
        name: dto.name,
        ycId: dto.ycId,
        ycName: dto.ycName,
        categoryId: dto.categoryId,
        categoryWithInfo: yClientsServiceCategoryFromId(dto.categoryId, categories),
        isNew: false,
    } as YClientsServiceView;
};


export const yClientsServiceCrmDtoToView = (dto: YClientsServiceDto,
    categories: YClientsServiceCategoryView[] | undefined = undefined
): YClientsServiceView => {
    return {
        //id: 'temp-' + Date.now(),
        id: undefined!,
        name: dto.ycName,
        ycId: dto.ycId,
        ycName: dto.ycName,
        categoryId: dto.categoryId,
        categoryWithInfo: yClientsServiceCategoryFromId(dto.categoryId, categories),
        isNew: true,
    } as YClientsServiceView;
}

export const yClientsServiceViewToDto = (item: YClientsServiceView): YClientsServiceDto => {
    return {
        id: item.id,
        name: item.name,
        ycId: item.ycId,
        ycName: item.ycName,
        categoryId: item.categoryId,
    };
};


export const yClientsPlaceDtoToView = (dto: YClientsPlaceDto): YClientsPlaceView => {
    return {
        id: dto.id,
        name: dto.name,
        ycId: dto.ycId,
        ycName: dto.ycName,
        available: dto.available,
        isNew: false,
    } as YClientsPlaceView;
};

export const yClientsPlaceCrmDtoToView = (dto: YClientsPlaceDto): YClientsPlaceView => {
    return {
        id: undefined!,
        name: dto.ycName,
        ycId: dto.ycId,
        ycName: dto.ycName,
        available: dto.available,
        isNew: true,
    } as YClientsPlaceView;
};

export const yClientsPlaceViewToDto = (item: YClientsPlaceView): YClientsPlaceDto => {
    return {
        id: item.id,
        name: item.name,
        ycId: item.ycId,
        ycName: item.ycName,
        available: item.available,
    };
};
