import { UserResponseDto } from "@mon3/sa";
import { RoleInfo } from "../roles/role-view.models";

export class UserInfo implements UserResponseDto {

    constructor(
        public id: string,
        public username: string,
        public email: string,
        public firstName: string,
        public lastName: string,
        public displayName: string,
        public avatarUrl: string | undefined,
        public active: boolean,
        public approved: boolean,
        public emailVerified: boolean,
        public roles: string[],
        public permissions: string[],
        public anonymous: boolean,
        public rolesWithInfo: RoleInfo[]
    ) { }

}
