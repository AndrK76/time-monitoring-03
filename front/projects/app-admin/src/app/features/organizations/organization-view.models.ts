import { OrganizationListDto, UserListItemDto } from "@mon3/sa";

export class OrganizationInfo implements OrganizationListDto {
    constructor(
        public id: string,
        public shortName: string,
        public fullName: string,
        public users?: string[],
        public usersWithInfo: UserListItemDto[] = []
    ) { }
}