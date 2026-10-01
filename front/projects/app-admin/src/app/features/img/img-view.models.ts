import { ImgAgentConfigDto, ImgAgentItemDto, ImgAgentTypeDto, ImgPlaceDto, ImgPlaceListDto } from '@mon3/sc';
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

export class ImgPlaceView implements ImgPlaceListDto {
    constructor(
        public id: string,
        public name: string,
        public internalName: string,
        public type: string,
    ) { }
}

export class ImgPlaceItemView implements ImgPlaceDto {
    constructor(
        public id: string,
        public type: string,
        public name: string,
        public internalName: string,
        public used: boolean,
        public actual: boolean,
        public present: boolean,
        public deleted: boolean,
    ) { }
}