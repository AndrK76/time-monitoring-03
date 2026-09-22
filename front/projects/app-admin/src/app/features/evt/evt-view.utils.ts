import { EvtAgentItemDto, EvtAgentListDto, EvtAgentTypeDto, EvtPlaceListDto } from '@mon3/sc';
import { EvtAgentItemView, EvtAgentTypeView, EvtPlaceView } from './evt-view.models';
import { OrgStructInfo } from '../struct-org/struct-org-view.models';

export const evtAgentTypeDtoToView = (dto: EvtAgentTypeDto): EvtAgentTypeView => {
    return {
        value: dto.value,
        name: dto.name,
        description: dto.description,
    } as EvtAgentTypeView;
};

export const evtAgentTypeFromId = (
    dtoId: string | undefined,
    allTypes: EvtAgentTypeView[] | undefined
): EvtAgentTypeView | undefined => {
    if (!dtoId || !allTypes) return undefined;
    return allTypes.find(f => f.value === dtoId);
};

export const evtOrgStructFromId = (
    dtoOrg: string | undefined,
    allOrgs: OrgStructInfo[] | undefined
): OrgStructInfo | undefined => {
    if (!dtoOrg || !allOrgs) return undefined;
    return allOrgs.find(f => f.id === dtoOrg);
};

export const evtPlaceListDtoToView = (dto: EvtPlaceListDto): EvtPlaceView => {
    return {
        id: dto.id,
        name: dto.name,
    } as EvtPlaceView;
};

export const evtAgentListDtoToView = (
    dto: EvtAgentListDto,
    agentTypes: EvtAgentTypeView[] | undefined = undefined,
    organizations: OrgStructInfo[] | undefined = undefined,
): EvtAgentItemView => {
    return {
        id: dto.id,
        organizationId: dto.organizationId,
        organization: evtOrgStructFromId(dto.organizationId, organizations),
        agentType: dto.agentType,
        agentTypeWithInfo: evtAgentTypeFromId(dto.agentType, agentTypes),
        name: dto.name,
        description: dto.description,
        configured: dto.configured,
        config: undefined,
        places: [],
    } as EvtAgentItemView;
};

export const evtAgentItemDtoToView = (
    dto: EvtAgentItemDto,
    agentTypes: EvtAgentTypeView[] | undefined = undefined,
    organizations: OrgStructInfo[] | undefined = undefined,
): EvtAgentItemView => {
    return {
        id: dto.id,
        organizationId: dto.organizationId,
        organization: evtOrgStructFromId(dto.organizationId, organizations),
        agentType: dto.agentType,
        agentTypeWithInfo: evtAgentTypeFromId(dto.agentType, agentTypes),
        name: dto.name,
        description: dto.description,
        configured: dto.configured,
        config: dto.config,
        places: (dto.places || []).map(evtPlaceListDtoToView),
    } as EvtAgentItemView;
};

export const evtAgentViewToListDto = (item: EvtAgentItemView): EvtAgentListDto => {
    return {
        id: item.id,
        organizationId: item.organizationId,
        agentType: item.agentType,
        name: item.name,
        description: item.description,
        configured: item.configured,
    } as EvtAgentListDto;
};

export const evtAgentViewToItemDto = (item: EvtAgentItemView): EvtAgentItemDto => {
    return {
        id: item.id,
        organizationId: item.organizationId,
        agentType: item.agentType,
        name: item.name,
        description: item.description,
        configured: item.configured,
        config: item.config,
        places: item.places,
    } as EvtAgentItemDto;
};

export const createNewEvtAgent = (
    orgId: string | undefined,
    agentType: string,
    agentTypes: EvtAgentTypeView[] | undefined = undefined,
    organizations: OrgStructInfo[] | undefined = undefined,
): EvtAgentItemView => {
    return {
        id: 'temp-' + Date.now(),
        organizationId: orgId,
        organization: evtOrgStructFromId(orgId, organizations),
        agentType: agentType,
        agentTypeWithInfo: evtAgentTypeFromId(agentType, agentTypes),
        name: '',
        description: undefined,
        configured: false,
        config: undefined,
        places: [],
    } as EvtAgentItemView;
};