import { OrganizationListDto, UserListItemDto } from "@mon3/sa";
import { UserShortInfo } from "../users/user-view.models";

export class OrganizationInfo implements OrganizationListDto {
    constructor(
        public id: string,
        public shortName: string,
        public fullName: string,
        public users?: string[],
        public usersWithInfo: UserShortInfo[] = []
    ) { }
}