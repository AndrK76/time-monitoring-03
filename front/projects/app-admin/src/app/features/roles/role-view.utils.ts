import { UpdateRoleRequestDto, RoleWithPermissionDto, PermissionResponseDto, RoleResponseDto } from "@mon3/sa";
import { PermissionInfo, RoleInfo, RoleWithPermissionsInfo } from "./role-view.models";

export const tempPermission = (permissionName: string): PermissionInfo => {
    return {
        id: `temp-${permissionName}`,
        name: `${permissionName}`,
        description: `${permissionName}`,
        special: false
    } as PermissionInfo;
}

export const rolePermissionsWithInfo = (dto: RoleWithPermissionsInfo | RoleWithPermissionDto, allPermissions: PermissionInfo[]): PermissionInfo[] => {
    const ret = (dto.permissions || []).map(permissionName => {
        const found = allPermissions.find(r => r.name === permissionName);
        return found || tempPermission(permissionName);
    });
    return ret;
}

export function roleResponseDtoToVIew(dto: RoleResponseDto): RoleInfo {
    return { ...dto } as RoleInfo;
}

export function roleRespWithPermissDtoToViewWithPermiss(dto: RoleWithPermissionDto, allPermissions: PermissionInfo[]): RoleWithPermissionsInfo {
    return {
        ...dto,
        description: dto.description || '', permissions: dto.permissions || [],
        permissionsWithInfo: rolePermissionsWithInfo(dto, allPermissions)
    } as RoleWithPermissionsInfo
}

export function createEmptyRoleWithPermiss(): RoleWithPermissionsInfo {
    return {
        id: `temp-${Date.now()}`,
        name: '', description: '', permissions: [],
        special: false, permissionsWithInfo: []
    } as RoleWithPermissionsInfo;

}

export const roleViewWithPermissToRequestDto = ({ name, description, permissions }
    : RoleWithPermissionsInfo): UpdateRoleRequestDto => ({ name, description, permissions });


export const permissionDtoToVIew = (dto: PermissionResponseDto): PermissionInfo => {
    return { ...dto };
}

