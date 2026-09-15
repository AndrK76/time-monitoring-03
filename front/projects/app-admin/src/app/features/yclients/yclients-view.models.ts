import { YClientCredentialsDto, YClientsAgentConfigDto, YClientsOrganizationDto, YClientsServiceCategoryListDto, YClientsServiceDto } from "@mon3/sc";

export class YClientsAgentConfigView implements YClientsAgentConfigDto {
    constructor(
        public id: string,
        public credentials: YClientCredentialsView,

    ) { }
}

export class YClientCredentialsView implements YClientCredentialsDto {
    public partnerToken?: string;
    public userToken?: string;
}


export class YClientsOrganizationView implements YClientsOrganizationDto {
    constructor(
        public id: string,
        public places: string[] | undefined,
        public agentId: string,
        public ycId: number | undefined,
        public name: string | undefined,
        public timezone: string | undefined,
        public _selected: boolean = false
    ) { }
}

export class YClientsServiceCategoryListView implements YClientsServiceCategoryListDto {
    constructor(
        public id: number,
        public name: string,
        public orgId: number,
        public existsNow: boolean,
        public existsCRM: boolean | undefined,
        public selected: boolean,
    ) { }

}

export class YClientsServiceView implements YClientsServiceDto {
    constructor(
        public id: string | undefined,
        public name: string | undefined,
        public ycId: number,
        public ycName: string,
        public categoryId: number,
        public categoryWithInfo: YClientsServiceCategoryListView | undefined,
        public isNew: boolean = false,
    ) { }
}