import { CrmAgentConfigDto, CrmAgentItemDto, CrmAgentTypeDto, CrmOrganizationDto, CrmServiceDto } from "@mon3/sc";
import { OrgStructInfo } from "../struct-org/struct-org-view.models";

export class CrmAgentTypeView implements CrmAgentTypeDto {
    constructor(
        public value: string,
        public name: string,
        public description: string,
    ) { }
}

export class CrmAgentConfigView implements CrmAgentConfigDto {
    constructor(
        public id: string,
        public agentType: string,
    ) { }
}

export class CrmOrganizationView implements CrmOrganizationDto {
    constructor(
        public id: string,
        public name: string,
    ) { }
}

export class CrmServiceView implements CrmServiceDto {
    constructor(
        public id: string,
        public name: string,
    ) { }
}


export class CrmAgentItemView implements CrmAgentItemDto {
    constructor(
        public id: string,
        public organizationId: string | undefined,
        public organization: OrgStructInfo | undefined,
        public agentType: string,
        public agentTypeWithInfo: CrmAgentTypeView | undefined,
        public name: string,
        public description: string | undefined,
        public configured: boolean | undefined,
        public config: CrmAgentConfigView | undefined,
        public crmOrganization: CrmOrganizationView | undefined,
        public services: CrmServiceView[],
    ) { }
}

