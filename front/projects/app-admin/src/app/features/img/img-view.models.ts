import { ImgAgentConfigDto, ImgAgentItemDto, ImgAgentTypeDto, ImgPlaceListDto } from '@mon3/sc';
import { OrgStructInfo } from '../struct-org/struct-org-view.models';

export class ImgAgentTypeView implements ImgAgentTypeDto {
    constructor(
        public value: string,
        public name: string,
        public description: string,
    ) { }
}

export class ImgAgentConfigView implements ImgAgentConfigDto {
    constructor(
        public id: string,
        public agentType: string,
    ) { }
}

export class ImgPlaceView implements ImgPlaceListDto {
    constructor(
        public id: string,
        public name: string,
    ) { }
}

export class ImgAgentItemView implements ImgAgentItemDto {
    constructor(
        public id: string,
        public organizationId: string | undefined,
        public organization: OrgStructInfo | undefined,
        public agentType: string,
        public agentTypeWithInfo: ImgAgentTypeView | undefined,
        public name: string,
        public description: string | undefined,
        public configured: boolean | undefined,
        public config: ImgAgentConfigView | undefined,
        public places: ImgPlaceView[],
    ) { }
}