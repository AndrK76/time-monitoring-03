import { UpdateRoleRequestDto, RoleWithPermissionDto, PermissionResponseDto, RoleResponseDto } from "@mon3/sa";
import { PermissionInfo, RoleInfo, RoleWithPermissionsInfo } from "./role-view.models";

export const permissionsWithInfo = (dto: RoleWithPermissionsInfo | RoleWithPermissionDto, allPermissions: PermissionInfo[]): PermissionInfo[] => {
    const ret = (dto.permissions || []).map(permissionName => {
        const found = allPermissions.find(r => r.name === permissionName);
        return found || new PermissionInfo('temp-' + permissionName, permissionName, '');
    });
    return ret;
}

export function roleResponseDtoToVIew(dto: RoleResponseDto): RoleInfo {
    return new RoleInfo(dto.id, dto.name, dto.description);
}

export function roleRespWithPermissDtoToViewWithPermiss(dto: RoleWithPermissionDto, allPermissions: PermissionInfo[]): RoleWithPermissionsInfo {
    return new RoleWithPermissionsInfo(
        dto.id,                                   //id
        dto.name,                                 //name
        dto.description || '',                    //description
        dto.permissions || [],                    //permissions
        permissionsWithInfo(dto, allPermissions)  //permissionsWithInfo
    );
}

export function createEmptyRoleWithPermiss(): RoleWithPermissionsInfo {
    return new RoleWithPermissionsInfo(
        'temp-' + Date.now(),      //id
        '',                        //name
        '',                        //description
        [],                        //permissions
        []                        //permissionsWithInfo
    );
}

export function roleViewWithPermissToRequestDto(item: RoleWithPermissionsInfo): UpdateRoleRequestDto {
    return {
        name: item.name,
        description: item.description,
        permissions: item.permissions
    };
}

export function permissionDtoToVIew(dto: PermissionResponseDto): PermissionInfo {
    return new PermissionInfo(dto.id, dto.name, dto.description);
}

