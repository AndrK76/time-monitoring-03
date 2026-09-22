import { EvtAgentConfigDto, EvtAgentItemDto, EvtAgentTypeDto, EvtPlaceListDto } from '@mon3/sc';
import { OrgStructInfo } from '../struct-org/struct-org-view.models';

export class EvtAgentTypeView implements EvtAgentTypeDto {
    constructor(
        public value: string,
        public name: string,
        public description: string,
    ) { }
}

export class EvtAgentConfigView implements EvtAgentConfigDto {
    constructor(
        public id: string,
        public agentType: string,
    ) { }
}

export class EvtPlaceView implements EvtPlaceListDto {
    constructor(
        public id: string,
        public name: string,
    ) { }
}

export class EvtAgentItemView implements EvtAgentItemDto {
    constructor(
        public id: string,
        public organizationId: string | undefined,
        public organization: OrgStructInfo | undefined,
        public agentType: string,
        public agentTypeWithInfo: EvtAgentTypeView | undefined,
        public name: string,
        public description: string | undefined,
        public configured: boolean | undefined,
        public config: EvtAgentConfigView | undefined,
        public places: EvtPlaceView[],
    ) { }
}