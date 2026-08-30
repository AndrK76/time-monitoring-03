import { RoleDto, UserResponseDto } from "@mon3/sa";

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

export class RoleInfo implements RoleDto {
    constructor(
        public name: string,
        public description: string,
    ) { }
}