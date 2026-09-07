import { OrgStructListDto } from "@mon3/sc"
import { OrgStructInfo } from "./struct-org-view.models"

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


