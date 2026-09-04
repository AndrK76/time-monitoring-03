import { PermissionResponseDto, RoleResponseDto, RoleWithPermissionDto } from "@mon3/sa";

export class RoleInfo implements RoleResponseDto {
    constructor(
        public id: string,
        public name: string,
        public special: boolean,
        public description: string,
    ) { }
}

export class RoleWithPermissionsInfo implements RoleWithPermissionDto {
    constructor(
        public id: string,
        public name: string,
        public description: string,
        public permissions: string[],
        public special: boolean,
        public permissionsWithInfo: PermissionInfo[]
    ) { }
}

export class PermissionInfo implements PermissionResponseDto {
    constructor(
        public id: string,
        public name: string,
        public special: boolean,
        public description: string,
    ) { }
}