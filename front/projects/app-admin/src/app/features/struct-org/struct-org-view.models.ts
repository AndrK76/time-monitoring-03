import { OrgStructListDto } from "@mon3/sc";

export class OrgStructInfo implements OrgStructListDto {
    constructor(
        public id: string,
        public shortName: string,
        public fullName: string,
        public crmAgentSet: boolean = false,
        public eventAgentsSet: boolean = false,
        public cameraAgentsSet: boolean = false
    ) { }
}