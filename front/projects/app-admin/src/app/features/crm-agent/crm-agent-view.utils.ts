import { CrmAgentItemDto, CrmAgentListDto, CrmAgentTypeDto } from "@mon3/sc";
import { CrmAgentItemView, CrmAgentTypeView } from "./crm-agent-view.models";
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

/*
export const agentTypeFromId = (dtoId: String | undefined, allTypes: CrmAgentTypeView[]): CrmAgentTypeView | undefined => {
    const ret = (dto.permissions || []).map(permissionName => {
        const found = allPermissions.find(r => r.name === permissionName);
        return found || tempPermission(permissionName);
    });
    return ret;
}
*/

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

export const crmAgentItemDtoToView = (dto: CrmAgentItemDto): CrmAgentItemView => {
    return {
        id: dto.id,
        organizationId: dto.organizationId,
        agentType: dto.agentType,
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

/*
export function orgStructListDtoToView(dto: OrgStructListDto): OrgStructInfo {
    return {
        id: dto.id,
        shortName: dto.shortName,
        fullName: dto.fullName,
        crmAgentSet: dto.crmAgentSet,
        eventAgentsSet: dto.eventAgentsSet,
        cameraAgentsSet: dto.cameraAgentsSet,
    } as OrgStructInfo
}

export function orgStructListDtofromView(data: OrgStructInfo): OrgStructListDto {
    return {
        id: data.id,
        shortName: data.shortName,
        fullName: data.fullName,
        crmAgentSet: data.crmAgentSet,
        eventAgentsSet: data.eventAgentsSet,
        cameraAgentsSet: data.cameraAgentsSet,
    } as OrgStructInfo
}
*/

