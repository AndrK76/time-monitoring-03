import { CrmAgentItemDto, CrmAgentListDto, CrmAgentTypeDto } from "@mon3/sc";
import { CrmAgentItemView, CrmAgentTypeView } from "./crm-view.models";
import { OrgStructInfo } from "../struct-org/struct-org-view.models";

export const crmAgentTypeDtoToView = (dto: CrmAgentTypeDto): CrmAgentTypeView => {
    return {
        value: dto.value,
        name: dto.name,
        description: dto.description,
    } as CrmAgentTypeView
}

export const agentTypeFromId = (dtoId: String | undefined, allTypes: CrmAgentTypeView[] | undefined): CrmAgentTypeView | undefined => {
    if (!dtoId || !allTypes) return undefined;
    return allTypes.find(f => f.value === dtoId);
}

export const orgStructFromId = (dtoOrg: String | undefined, allOrgs: OrgStructInfo[] | undefined): OrgStructInfo | undefined => {
    if (!dtoOrg || !allOrgs) return undefined;
    return allOrgs.find(f => f.id === dtoOrg);
}


export const crmAgentListDtoToView = (dto: CrmAgentListDto,
    agentTypes: CrmAgentTypeView[] | undefined = undefined,
    organizations: OrgStructInfo[] | undefined = undefined,
): CrmAgentItemView => {
    return {
        id: dto.id,
        organizationId: dto.organizationId,
        organization: orgStructFromId(dto.organizationId, organizations),
        agentType: dto.agentType,
        agentTypeWithInfo: agentTypeFromId(dto.agentType, agentTypes),
        name: dto.name,
        description: dto.description,
        configured: dto.configured,
        config: undefined,
        crmOrganization: undefined,
        services: [],
    } as CrmAgentItemView
}

export const crmAgentItemDtoToView = (dto: CrmAgentItemDto,
    agentTypes: CrmAgentTypeView[] | undefined = undefined,
    organizations: OrgStructInfo[] | undefined = undefined,
): CrmAgentItemView => {
    return {
        id: dto.id,
        organizationId: dto.organizationId,
        organization: orgStructFromId(dto.organizationId, organizations),
        agentType: dto.agentType,
        agentTypeWithInfo: agentTypeFromId(dto.agentType, agentTypes),
        name: dto.name,
        description: dto.description,
        configured: dto.configured,
        config: dto.config,
        crmOrganization: dto.crmOrganization,
        services: dto.services,
    } as CrmAgentItemView
}

export const crmAgentViewToListDto = (item: CrmAgentItemView): CrmAgentListDto => {
    return {
        id: item.id,
        organizationId: item.organizationId,
        agentType: item.agentType,
        name: item.name,
        description: item.description,
        configured: item.configured,
    } as CrmAgentListDto;
}

export const crmAgentViewToItemDto = (item: CrmAgentItemView): CrmAgentItemDto => {
    return {
        id: item.id,
        organizationId: item.organizationId,
        agentType: item.agentType,
        name: item.name,
        description: item.description,
        configured: item.configured,
        config: item.config,
        crmOrganization: item.crmOrganization,
        services: item.services
    } as CrmAgentItemDto;
}

export const createNewAgent = (orgId: string | undefined, agentType: string,
    agentTypes: CrmAgentTypeView[] | undefined = undefined,
    organizations: OrgStructInfo[] | undefined = undefined): CrmAgentItemView => {
    return {
        id: 'temp-' + Date.now(),
        organizationId: orgId,
        organization: orgStructFromId(orgId, organizations),
        agentType: agentType,
        agentTypeWithInfo: agentTypeFromId(agentType, agentTypes),
        name: '',
        description: undefined,
        configured: false,
        config: undefined,
        crmOrganization: undefined,
        services: []
    } as CrmAgentItemView
} 
