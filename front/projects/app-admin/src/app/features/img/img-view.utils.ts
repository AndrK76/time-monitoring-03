import { ImgAgentItemDto, ImgAgentListDto, ImgAgentTypeDto, ImgPlaceDto, ImgPlaceListDto } from '@mon3/sc';
import { ImgAgentItemView, ImgAgentTypeView, ImgPlaceItemView, ImgPlaceView } from './img-view.models';
import { OrgStructInfo } from '../struct-org/struct-org-view.models';

export const imgAgentTypeDtoToView = (dto: ImgAgentTypeDto): ImgAgentTypeView => {
    return {
        value: dto.value,
        name: dto.name,
        description: dto.description,
    } as ImgAgentTypeView;
};

export const imgAgentTypeFromId = (
    dtoId: string | undefined,
    allTypes: ImgAgentTypeView[] | undefined
): ImgAgentTypeView | undefined => {
    if (!dtoId || !allTypes) return undefined;
    return allTypes.find(f => f.value === dtoId);
};

export const imgOrgStructFromId = (
    dtoOrg: string | undefined,
    allOrgs: OrgStructInfo[] | undefined
): OrgStructInfo | undefined => {
    if (!dtoOrg || !allOrgs) return undefined;
    return allOrgs.find(f => f.id === dtoOrg);
};

export const imgAgentListDtoToView = (
    dto: ImgAgentListDto,
    agentTypes: ImgAgentTypeView[] | undefined = undefined,
    organizations: OrgStructInfo[] | undefined = undefined,
): ImgAgentItemView => {
    return {
        id: dto.id,
        organizationId: dto.organizationId,
        organization: imgOrgStructFromId(dto.organizationId, organizations),
        agentType: dto.agentType,
        agentTypeWithInfo: imgAgentTypeFromId(dto.agentType, agentTypes),
        name: dto.name,
        description: dto.description,
        configured: dto.configured,
        config: undefined,
        places: [],
    } as ImgAgentItemView;
};

export const imgAgentItemDtoToView = (
    dto: ImgAgentItemDto,
    agentTypes: ImgAgentTypeView[] | undefined = undefined,
    organizations: OrgStructInfo[] | undefined = undefined,
): ImgAgentItemView => {
    return {
        id: dto.id,
        organizationId: dto.organizationId,
        organization: imgOrgStructFromId(dto.organizationId, organizations),
        agentType: dto.agentType,
        agentTypeWithInfo: imgAgentTypeFromId(dto.agentType, agentTypes),
        name: dto.name,
        description: dto.description,
        configured: dto.configured,
        config: dto.config,
        places: (dto.places || []).map(imgPlaceListDtoToView),
    } as ImgAgentItemView;
};

export const imgAgentViewToListDto = (item: ImgAgentItemView): ImgAgentListDto => {
    return {
        id: item.id,
        organizationId: item.organizationId,
        agentType: item.agentType,
        name: item.name,
        description: item.description,
        configured: item.configured,
    } as ImgAgentListDto;
};

export const imgAgentViewToItemDto = (item: ImgAgentItemView): ImgAgentItemDto => {
    return {
        id: item.id,
        organizationId: item.organizationId,
        agentType: item.agentType,
        name: item.name,
        description: item.description,
        configured: item.configured,
        config: item.config,
        places: item.places,
    } as ImgAgentItemDto;
};

export const createNewImgAgent = (
    orgId: string | undefined,
    agentType: string,
    agentTypes: ImgAgentTypeView[] | undefined = undefined,
    organizations: OrgStructInfo[] | undefined = undefined,
): ImgAgentItemView => {
    return {
        id: 'temp-' + Date.now(),
        organizationId: orgId,
        organization: imgOrgStructFromId(orgId, organizations),
        agentType: agentType,
        agentTypeWithInfo: imgAgentTypeFromId(agentType, agentTypes),
        name: '',
        description: undefined,
        configured: false,
        config: undefined,
        places: [],
    } as ImgAgentItemView;
};


export const imgPlaceListDtoToView = (dto: ImgPlaceListDto): ImgPlaceView => {
    return {
        id: dto.id,
        name: dto.name,
        internalName: dto.internalName,
        type: dto.type,
    } as ImgPlaceView;
};

export const imgPlaceDtoToView = (dto: ImgPlaceDto): ImgPlaceItemView => {
    return {
        id: dto.id,
        type: dto.type,
        name: dto.name,
        internalName: dto.internalName,
        used: dto.used,
        actual: dto.actual,
        present: dto.present,
        deleted: dto.deleted,
    } as ImgPlaceItemView;
};